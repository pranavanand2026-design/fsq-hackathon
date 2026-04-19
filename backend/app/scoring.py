"""Scoring engine. 5 signals, all from Foursquare data.

Signals (weights sum to 100):
  - competition_density (25) — fewer direct competitors within 500m = higher
  - anchor_pull         (25) — closer to nearest anchor (uni, mall, hospital) = higher
  - foot_traffic_proxy  (20) — more retail+F&B POIs within 300m = higher
  - transit_proximity   (15) — closer to nearest transit POI = higher
  - cannibalization     (15) — farther from same-brand = higher
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable

import h3

from .db import get_con, get_config, get_vertical

WEIGHTS = {
    "market_saturation": 25,
    "cannibalisation": 25,
    "surrounding_amenities": 20,
    "transit_accessibility": 15,
    "demographic_match": 15,
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


def _score_market_saturation(n: int) -> float:
    return _lerp_clamp(n, at_zero=PARAMS["competitor_saturation"], at_hundred=0)


def _score_surrounding_amenities(dist_m: float | None, n_complementary: int) -> float:
    s_anchor = 0.0
    if dist_m is not None:
        s_anchor = _lerp_clamp(
            dist_m,
            at_zero=PARAMS["anchor_zero_m"],
            at_hundred=PARAMS["anchor_full_score_m"],
        )
    s_comp = _lerp_clamp(n_complementary, at_zero=0, at_hundred=10)
    return (s_anchor * 0.5) + (s_comp * 0.5)


def _score_demographic_match(n: int) -> float:
    return _lerp_clamp(n, at_zero=0, at_hundred=PARAMS["foot_traffic_saturation"])


def _score_transit_accessibility(dist_m: float | None) -> float:
    if dist_m is None:
        return 0.0
    return _lerp_clamp(
        dist_m,
        at_zero=PARAMS["transit_zero_m"],
        at_hundred=PARAMS["transit_full_score_m"],
    )


def _score_cannibalisation(dist_m: float | None) -> float:
    # No same-brand nearby = best case
    if dist_m is None:
        return 100.0
    return _lerp_clamp(
        dist_m,
        at_zero=PARAMS["cannibal_zero_m"],
        at_hundred=PARAMS["cannibal_full_score_m"],
    )


# ─── Caching layer ──────────────────────────────────────────────────────────

# Cache keyed on (vertical, brand_slug, locality) — avoids re-scoring 12K hexes
# for every hex_report() and compare() call. Cleared on restart.
_score_cache: dict[tuple, list[HexScore]] = {}


def _cache_key(vertical: str, brand_slug: str | None, locality: str | None) -> tuple:
    return (vertical, brand_slug or "", locality or "")


def _get_cached_scores(vertical: str, brand_slug: str | None = None, locality: str | None = None) -> list[HexScore]:
    """Return cached scores or compute and cache them."""
    key = _cache_key(vertical, brand_slug, locality)
    if key not in _score_cache:
        _score_cache[key] = _score_hexes_impl(vertical, brand_slug, locality)
    return _score_cache[key]


# ─── Main scoring query ──────────────────────────────────────────────────────


def _score_hexes_impl(
    vertical_key: str,
    brand_slug: str | None = None,
    locality_filter: str | None = None,
) -> list[HexScore]:
    """Internal implementation of score_hexes (called by cache)."""
    con = get_con()
    tagged = _category_tag_cte(vertical_key)

    locality_where = ""
    if locality_filter:
        safe = locality_filter.replace("'", "''")
        locality_where = f"AND LOWER(h.locality) LIKE LOWER('%{safe}%')"

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
        {"MIN(dist_m) FILTER (WHERE brand_slug LIKE '" + brand_slug.replace(chr(39), chr(39)*2) + "%' AND dist_m > 0)" if brand_slug else 'NULL'}
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
            "market_saturation":     round(_score_market_saturation(d["n_competitors"])),
            "cannibalisation":       round(_score_cannibalisation(d["d_cannibal_m"])),
            "surrounding_amenities": round(_score_surrounding_amenities(d["d_anchor_m"], d["n_complementary"])),
            "transit_accessibility": round(_score_transit_accessibility(d["d_transit_m"])),
            "demographic_match":     round(_score_demographic_match(d["n_retail"])),
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


def score_hexes(
    vertical_key: str,
    brand_slug: str | None = None,
    locality_filter: str | None = None,
) -> list[HexScore]:
    """Score every hex that has POIs; optionally filter by locality.

    Uses caching so hex_report() and compare() don't re-score 12K hexes each time.

    brand_slug: normalized slug of the user's own brand (for cannibalization).
                If None, cannibalization signal is neutral (100).
    """
    return _get_cached_scores(vertical_key, brand_slug, locality_filter)


# ─── Diversity Index ─────────────────────────────────────────────────────────


def _compute_diversity(con, lat: float, lng: float, radius_m: int = 300) -> float:
    """Compute Shannon diversity index (H') of POI categories within radius.
    
    Returns a normalized 0–1 score where 1 = perfectly diverse.
    """
    dist_sql = _haversine_sql(str(lat), str(lng), "latitude", "longitude")
    sql = f"""
    SELECT primary_category, COUNT(*) AS cnt
    FROM pois
    WHERE primary_category IS NOT NULL
      AND latitude BETWEEN {lat} - 0.005 AND {lat} + 0.005
      AND longitude BETWEEN {lng} - 0.006 AND {lng} + 0.006
      AND {dist_sql} <= {radius_m}
    GROUP BY primary_category
    """
    rows = con.execute(sql).fetchall()
    if not rows:
        return 0.0
    
    total = sum(r[1] for r in rows)
    if total <= 1:
        return 0.0
    
    # Shannon H' = -Σ (pi * ln(pi))
    h_prime = 0.0
    for _, cnt in rows:
        p = cnt / total
        if p > 0:
            h_prime -= p * math.log(p)
    
    # Normalize to 0–1 using max possible H' = ln(S)
    s = len(rows)  # number of unique categories
    h_max = math.log(s) if s > 1 else 1.0
    return round(min(h_prime / h_max, 1.0), 2)


# ─── AI Insight generator ───────────────────────────────────────────────────


def _generate_ai_insight(
    locality: str | None,
    score: int,
    signals_raw: dict,
    nearest_competitors: list[dict],
    nearest_anchors: list[dict],
    nearest_complementary: list[dict],
    nearest_transit: list[dict],
    diversity: float,
) -> str:
    """Generate a high-end, data-backed enterprise insight paragraph."""
    area = locality or "The designated area"
    parts = []
    
    # Executive assessment
    if score >= 85:
        parts.append(f"**Executive Summary:** {area} presents a highly lucrative site-selection opportunity with a composite score of {score}/100, driven by minimal market saturation and strong local synergies.")
    elif score >= 70:
        parts.append(f"**Executive Summary:** {area} yields a solid rating of {score}/100, indicating viable expansion potential with a balanced risk-return profile.")
    elif score >= 50:
        parts.append(f"**Executive Summary:** {area} scores {score}/100. This location carries moderate viability risk and warrants careful tactical review before greenlighting investment.")
    else:
        parts.append(f"**Executive Summary:** {area} scores {score}/100. We flag this as a high-risk zone—location criteria fall well below enterprise thresholds for successful expansion.")
    
    # 1. Market Saturation
    n_comp = signals_raw.get("n_competitors", 0)
    if n_comp == 0:
        parts.append("• **Market Saturation:** Highly favorable. A total absence of direct competitors within 500m creates immediate white-space capture potential.")
    elif n_comp <= 2:
        parts.append(f"• **Market Saturation:** Favorable. Isolated competitive presence ({n_comp} identified within the catchment), suggesting ample headroom for market share acquisition.")
    else:
        closest = nearest_competitors[0] if nearest_competitors else None
        dist_str = f" as close as {closest['dist_m']}m" if closest else ""
        parts.append(f"• **Market Saturation:** High risk. Severe catchment overlap with {n_comp} existing venues{dist_str}. Margin compression and reduced same-store sales trajectories are likely without significant differentiation.")
    
    # 2. Cannibalisation
    d_cannibal = signals_raw.get("d_cannibal_m")
    if d_cannibal is not None and d_cannibal < 500:
        parts.append(f"• **Cannibalisation:** Critical warning. Existing brand network node is just {round(d_cannibal)}m away. Proceeding risks significant customer redistribution and network-wide yield degradation.")
    elif d_cannibal is not None and d_cannibal < 1500:
        parts.append(f"• **Cannibalisation:** Moderate risk. Closest brand presence is at {round(d_cannibal)}m—requiring tactical marketing alignment to avoid customer extraction.")
    else:
        parts.append("• **Cannibalisation:** Negligible risk. Zero same-brand proximity threats detected within the core trade area.")

    # 3. Surrounding Amenities & 4. Demographic Match proxy
    n_comp_nearby = len(nearest_complementary)
    anchor_str = ""
    if nearest_anchors:
        anchor = nearest_anchors[0]
        anchor_str = f" and major anchor draw ({anchor['name']} at {anchor['dist_m']}m)"
    
    if n_comp_nearby >= 3 or nearest_anchors:
        parts.append(f"• **Surrounding Amenities & Demographics:** {n_comp_nearby} complementary businesses{anchor_str} drive robust auxiliary footfall. A category diversity rating of {diversity}/1.0 indicates strong local purchasing vitality.")
    else:
        parts.append(f"• **Surrounding Amenities & Demographics:** Critical lack of complementary F&B venues and anchors. A low category diversity ({diversity}/1.0) points to a weak demographic pull for this site.")

    # 5. Transit
    if nearest_transit:
        t = nearest_transit[0]
        parts.append(f"• **Transit Accessibility:** Proximity to {t['name']} ({t['dist_m']}m) anchors the transit corridor, optimizing workforce logistics and amplifying peak-hour commuter capture.")
    else:
        parts.append("• **Transit Accessibility:** Limited immediate mass-transit nodes, weighting reliance toward local residential or drive-by traffic.")
    
    return "\n\n".join(parts)


# ─── Per-hex drill-down (for the report panel) ───────────────────────────────


def hex_report(vertical_key: str, h3_id: str, brand_slug: str | None = None) -> dict:
    """Return a full report for a single hex: score, components, top nearby POIs."""
    con = get_con()
    tagged = _category_tag_cte(vertical_key)

    # Resolve hex center
    lat, lng = h3.cell_to_latlng(h3_id)

    # Use cached scores instead of re-scoring all 12K hexes
    all_scores = _get_cached_scores(vertical_key, brand_slug=brand_slug)
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

    # Compute real diversity index
    diversity = _compute_diversity(con, lat, lng)

    # Generate AI insight
    ai_insight = _generate_ai_insight(
        locality=hit.locality,
        score=hit.score,
        signals_raw=hit.signals_raw,
        nearest_competitors=competitors,
        nearest_anchors=anchors,
        nearest_complementary=complementary,
        nearest_transit=transit,
        diversity=diversity,
    )

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
        "diversity_index": diversity,
        "ai_insight": ai_insight,
    }
