"""Scoring engine. 5 signals, all from Foursquare data.

Signals (weights sum to 100):
  - competition_density (25) — fewer direct competitors within 500m = higher
  - anchor_pull         (25) — closer to nearest anchor (uni, mall, hospital) = higher
  - foot_traffic_proxy  (20) — more retail+F&B POIs within 300m = higher
  - transit_proximity   (15) — closer to nearest transit POI = higher
  - cannibalization     (15) — farther from same-brand = higher
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import h3

from .db import get_con, get_config, get_vertical

WEIGHTS = {
    "competition_density": 25,
    "anchor_pull":         25,
    "foot_traffic_proxy":  20,
    "transit_proximity":   15,
    "cannibalization":     15,
}

# Scoring tuning parameters — tunable without code changes
PARAMS = {
    "competitor_radius_m":   500,
    "complementary_radius_m": 300,
    "foot_traffic_radius_m":  300,
    # Normalization: at these values a signal hits score 0 or 100
    "competitor_saturation":   8,      # 8+ competitors -> score 0
    "anchor_full_score_m":     400,    # <=400m to anchor -> score 100
    "anchor_zero_m":          2500,    # >=2500m to anchor -> score 0
    "foot_traffic_saturation": 40,     # 40+ retail/F&B POIs nearby -> score 100
    "transit_full_score_m":    300,
    "transit_zero_m":         1500,
    "cannibal_full_score_m":  1500,    # >=1500m from same-brand -> score 100
    "cannibal_zero_m":         200,    # <=200m -> score 0
}


@dataclass
class HexScore:
    h3_id: str
    lat: float
    lng: float
    locality: str | None
    score: int
    components: dict[str, int]
    signals_raw: dict[str, float]


# ─── SQL helpers ─────────────────────────────────────────────────────────────


def _match_any_clause(labels: list[str], alias: str = "primary_category") -> str:
    """Build a SQL clause: (<alias> = 'L1' OR <alias> = 'L2' OR ...). Case-insensitive."""
    if not labels:
        return "FALSE"
    quoted = [l.replace("'", "''") for l in labels]
    return "(" + " OR ".join(f"LOWER({alias}) = LOWER('{l}')" for l in quoted) + ")"


def _category_tag_cte(vertical_key: str) -> str:
    """CTE that tags every POI with booleans used by the scorer."""
    v = get_vertical(vertical_key)
    cfg = get_config()
    transit = cfg.get("transit_categories", [])
    retail = cfg.get("retail_fnb_categories", [])
    return f"""
    tagged AS (
      SELECT
        fsq_place_id,
        name,
        latitude,
        longitude,
        locality,
        primary_category,
        brand_slug,
        h3_9,
        {_match_any_clause(v["competitors"])} AS is_competitor,
        {_match_any_clause(v["complementary"])} AS is_complementary,
        {_match_any_clause(v["anchors"])} AS is_anchor,
        {_match_any_clause(transit)} AS is_transit,
        {_match_any_clause(retail)} AS is_retail_fnb
      FROM pois
    )
    """


def _haversine_sql(a_lat_expr: str, a_lng_expr: str, b_lat_expr: str, b_lng_expr: str) -> str:
    """Haversine meters between two SQL expressions."""
    return f"""
    (2 * 6371000 * ASIN(SQRT(
      POWER(SIN(RADIANS({b_lat_expr} - {a_lat_expr}) / 2), 2) +
      COS(RADIANS({a_lat_expr})) * COS(RADIANS({b_lat_expr})) *
      POWER(SIN(RADIANS({b_lng_expr} - {a_lng_expr}) / 2), 2)
    )))
    """


HAVERSINE_M_SQL = _haversine_sql("a_lat", "a_lng", "b_lat", "b_lng")


# ─── Normalizers ─────────────────────────────────────────────────────────────


def _lerp_clamp(value: float, at_zero: float, at_hundred: float) -> float:
    """Linear 0-100, clamped. Works both directions (at_zero can be > at_hundred)."""
    if at_zero == at_hundred:
        return 100.0 if value == at_zero else 0.0
    t = (value - at_zero) / (at_hundred - at_zero)
    return max(0.0, min(100.0, t * 100.0))


def _score_competition(n: int) -> float:
    return _lerp_clamp(n, at_zero=PARAMS["competitor_saturation"], at_hundred=0)


def _score_anchor(dist_m: float | None) -> float:
    if dist_m is None:
        return 0.0
    return _lerp_clamp(
        dist_m,
        at_zero=PARAMS["anchor_zero_m"],
        at_hundred=PARAMS["anchor_full_score_m"],
    )


def _score_foot_traffic(n: int) -> float:
    return _lerp_clamp(n, at_zero=0, at_hundred=PARAMS["foot_traffic_saturation"])


def _score_transit(dist_m: float | None) -> float:
    if dist_m is None:
        return 0.0
    return _lerp_clamp(
        dist_m,
        at_zero=PARAMS["transit_zero_m"],
        at_hundred=PARAMS["transit_full_score_m"],
    )


def _score_cannibal(dist_m: float | None) -> float:
    # No same-brand nearby = best case
    if dist_m is None:
        return 100.0
    return _lerp_clamp(
        dist_m,
        at_zero=PARAMS["cannibal_zero_m"],
        at_hundred=PARAMS["cannibal_full_score_m"],
    )


# ─── Main scoring query ──────────────────────────────────────────────────────


def score_hexes(
    vertical_key: str,
    brand_slug: str | None = None,
    locality_filter: str | None = None,
) -> list[HexScore]:
    """Score every hex that has POIs; optionally filter by locality.

    brand_slug: normalized slug of the user's own brand (for cannibalization).
                If None, cannibalization signal is neutral (100).
    """
    con = get_con()
    tagged = _category_tag_cte(vertical_key)

    locality_where = ""
    if locality_filter:
        safe = locality_filter.replace("'", "''")
        locality_where = f"AND LOWER(h.locality) LIKE LOWER('%{safe}%')"

    # 1. Build hex centers + locality from the data
    # 2. For each hex center, aggregate:
    #    - competitors within radius
    #    - complementary within radius
    #    - retail_fnb within radius (foot-traffic proxy)
    #    - min distance to anchor, transit, same-brand
    sql = f"""
    WITH {tagged},
    hex_centers AS (
      SELECT
        h3_9,
        AVG(latitude)  AS lat,
        AVG(longitude) AS lng,
        MODE() WITHIN GROUP (ORDER BY locality) AS locality
      FROM tagged
      WHERE h3_9 IS NOT NULL
      GROUP BY h3_9
    ),
    joined AS (
      SELECT
        hc.h3_9, hc.lat AS a_lat, hc.lng AS a_lng, hc.locality,
        t.latitude AS b_lat, t.longitude AS b_lng,
        t.is_competitor, t.is_complementary, t.is_anchor,
        t.is_transit, t.is_retail_fnb, t.brand_slug
      FROM hex_centers hc
      CROSS JOIN tagged t
      WHERE
        -- bbox prefilter to keep this cheap (~0.03 deg ≈ 3km)
        t.latitude  BETWEEN hc.lat - 0.03 AND hc.lat + 0.03
        AND t.longitude BETWEEN hc.lng - 0.035 AND hc.lng + 0.035
    ),
    with_dist AS (
      SELECT *, {HAVERSINE_M_SQL} AS dist_m FROM joined
    ),
    agg AS (
      SELECT
        h3_9,
        ANY_VALUE(a_lat) AS lat,
        ANY_VALUE(a_lng) AS lng,
        ANY_VALUE(locality) AS locality,
        COUNT(*) FILTER (WHERE is_competitor AND dist_m <= {PARAMS["competitor_radius_m"]}) AS n_competitors,
        COUNT(*) FILTER (WHERE is_complementary AND dist_m <= {PARAMS["complementary_radius_m"]}) AS n_complementary,
        COUNT(*) FILTER (WHERE is_retail_fnb   AND dist_m <= {PARAMS["foot_traffic_radius_m"]}) AS n_retail,
        MIN(dist_m) FILTER (WHERE is_anchor)  AS d_anchor_m,
        MIN(dist_m) FILTER (WHERE is_transit) AS d_transit_m,
        {("MIN(dist_m) FILTER (WHERE brand_slug LIKE '" + brand_slug.replace(chr(39), chr(39)*2) + "%' AND dist_m > 0)") if brand_slug else 'NULL'}
          AS d_cannibal_m
      FROM with_dist h
      WHERE 1=1
        {locality_where}
      GROUP BY h3_9
    )
    SELECT * FROM agg
    ORDER BY h3_9
    """

    rows = con.execute(sql).fetchall()
    cols = [c[0] for c in con.description]

    out: list[HexScore] = []
    for row in rows:
        d = dict(zip(cols, row))
        components = {
            "competition_density": round(_score_competition(d["n_competitors"])),
            "anchor_pull":         round(_score_anchor(d["d_anchor_m"])),
            "foot_traffic_proxy":  round(_score_foot_traffic(d["n_retail"])),
            "transit_proximity":   round(_score_transit(d["d_transit_m"])),
            "cannibalization":     round(_score_cannibal(d["d_cannibal_m"])),
        }
        total = round(
            sum(components[k] * (WEIGHTS[k] / 100.0) for k in WEIGHTS)
        )
        out.append(
            HexScore(
                h3_id=d["h3_9"],
                lat=float(d["lat"]),
                lng=float(d["lng"]),
                locality=d["locality"],
                score=int(total),
                components=components,
                signals_raw={
                    "n_competitors":   int(d["n_competitors"]),
                    "n_complementary": int(d["n_complementary"]),
                    "n_retail":        int(d["n_retail"]),
                    "d_anchor_m":      float(d["d_anchor_m"]) if d["d_anchor_m"] is not None else None,
                    "d_transit_m":     float(d["d_transit_m"]) if d["d_transit_m"] is not None else None,
                    "d_cannibal_m":    float(d["d_cannibal_m"]) if d["d_cannibal_m"] is not None else None,
                },
            )
        )
    return out


# ─── Per-hex drill-down (for the report panel) ───────────────────────────────


def hex_report(vertical_key: str, h3_id: str, brand_slug: str | None = None) -> dict:
    """Return a full report for a single hex: score, components, top nearby POIs."""
    con = get_con()
    tagged = _category_tag_cte(vertical_key)

    # Resolve hex center
    lat, lng = h3.cell_to_latlng(h3_id)

    # Get the full HexScore first (single-hex filter done in python since
    # score_hexes is already cheap and this keeps code DRY)
    all_scores = score_hexes(vertical_key, brand_slug=brand_slug)
    hit = next((s for s in all_scores if s.h3_id == h3_id), None)
    if hit is None:
        # Compute standalone (hex may be outside POI data but within Sydney)
        hit = HexScore(
            h3_id=h3_id, lat=lat, lng=lng, locality=None, score=0,
            components={k: 0 for k in WEIGHTS},
            signals_raw={
                "n_competitors": 0, "n_complementary": 0, "n_retail": 0,
                "d_anchor_m": None, "d_transit_m": None, "d_cannibal_m": None,
            },
        )

    # Nearest competitors (top 5), nearest complementary (top 5), nearest anchors (top 3)
    def nearest(flag_col: str, k: int, max_m: int = 2000) -> list[dict]:
        dist_sql = _haversine_sql(str(lat), str(lng), "latitude", "longitude")
        sql = f"""
        WITH {tagged}
        SELECT
          name, primary_category, latitude, longitude, locality,
          {dist_sql} AS dist_m
        FROM tagged
        WHERE {flag_col} AND {dist_sql} <= {max_m}
        ORDER BY dist_m
        LIMIT {k}
        """
        rows = con.execute(sql).fetchall()
        cols = [c[0] for c in con.description]
        out = []
        for r in rows:
            d = dict(zip(cols, r))
            if d["dist_m"] is None:
                continue
            d["dist_m"] = round(float(d["dist_m"]))
            out.append(d)
        return out

    competitors = nearest("is_competitor", 5)
    complementary = nearest("is_complementary", 5)
    anchors = nearest("is_anchor", 3, max_m=3000)
    transit = nearest("is_transit", 2, max_m=2000)

    return {
        "h3_id": hit.h3_id,
        "lat": hit.lat,
        "lng": hit.lng,
        "locality": hit.locality,
        "score": hit.score,
        "components": hit.components,
        "signals_raw": hit.signals_raw,
        "weights": WEIGHTS,
        "nearest_competitors": competitors,
        "nearest_complementary": complementary,
        "nearest_anchors": anchors,
        "nearest_transit": transit,
    }
