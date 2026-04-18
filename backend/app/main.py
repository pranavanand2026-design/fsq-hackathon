"""FastAPI entrypoint for GapMap."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root if present
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .claude_chat import chat as claude_chat
from .db import get_config, get_con
from .scoring import hex_report, score_hexes

app = FastAPI(title="GapMap API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ─────────────────────────────────────────────────────────────────


class HeatmapRequest(BaseModel):
    vertical: str = Field(..., description="e.g. bubble_tea, coffee, fast_casual")
    brand_slug: str | None = None
    locality: str | None = None


class ReportRequest(BaseModel):
    vertical: str
    h3_id: str
    brand_slug: str | None = None


class CompareRequest(BaseModel):
    vertical: str
    h3_ids: list[str]
    brand_slug: str | None = None


class ChatRequest(BaseModel):
    message: str


# ─── Endpoints ───────────────────────────────────────────────────────────────


@app.get("/api/health")
def health() -> dict:
    con = get_con()
    n = con.execute("SELECT COUNT(*) FROM pois").fetchone()[0]
    return {"ok": True, "poi_count": int(n)}


@app.get("/api/verticals")
def list_verticals() -> dict:
    cfg = get_config()
    return {
        "verticals": [
            {
                "key": k,
                "label": v["label"],
                "competitors": v["competitors"],
                "anchors": v["anchors"],
                "complementary": v["complementary"],
            }
            for k, v in cfg["verticals"].items()
        ]
    }


@app.post("/api/heatmap")
def api_heatmap(req: HeatmapRequest) -> dict:
    try:
        scores = score_hexes(
            req.vertical, brand_slug=req.brand_slug, locality_filter=req.locality
        )
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "vertical": req.vertical,
        "count": len(scores),
        "hexes": [
            {
                "h3_id": s.h3_id,
                "lat": s.lat,
                "lng": s.lng,
                "locality": s.locality,
                "score": s.score,
                "components": s.components,
                "n_competitors":   s.signals_raw["n_competitors"],
                "n_complementary": s.signals_raw["n_complementary"],
            }
            for s in scores
        ],
    }


@app.post("/api/report")
def api_report(req: ReportRequest) -> dict:
    try:
        return hex_report(req.vertical, req.h3_id, brand_slug=req.brand_slug)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/compare")
def api_compare(req: CompareRequest) -> dict:
    reports = [
        hex_report(req.vertical, h, brand_slug=req.brand_slug) for h in req.h3_ids
    ]
    return {"reports": reports}


@app.get("/api/pins")
def api_pins(
    vertical: str,
    min_lat: float,
    max_lat: float,
    min_lng: float,
    max_lng: float,
    limit: int = 400,
) -> dict:
    """Return competitor + complementary + anchor pins within a bbox."""
    from .scoring import _category_tag_cte

    con = get_con()
    tagged = _category_tag_cte(vertical)
    sql = f"""
    WITH {tagged}
    SELECT
      fsq_place_id, name, primary_category, latitude, longitude, locality,
      is_competitor, is_complementary, is_anchor, is_transit
    FROM tagged
    WHERE latitude  BETWEEN {min_lat} AND {max_lat}
      AND longitude BETWEEN {min_lng} AND {max_lng}
      AND (is_competitor OR is_complementary OR is_anchor OR is_transit)
    LIMIT {int(limit)}
    """
    rows = con.execute(sql).fetchall()
    cols = [c[0] for c in con.description]
    return {"pins": [dict(zip(cols, r)) for r in rows]}


@app.post("/api/chat")
def api_chat(req: ChatRequest) -> dict:
    return claude_chat(req.message)
