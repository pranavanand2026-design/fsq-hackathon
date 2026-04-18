"""Claude tool-use bridge for the chat bar.

User NL query -> Claude -> structured tool call -> deterministic DuckDB query ->
results -> Claude narrates with a short insight.

Tools:
  - filter_locations: applies vertical + locality + must_have_nearby filters,
    returns ranked hexes
  - generate_insight: formats a structured insight card for a chosen hex
"""

from __future__ import annotations

import json
import os
from typing import Any

try:
    from anthropic import Anthropic
except Exception:  # pragma: no cover
    Anthropic = None  # type: ignore

from .db import get_config
from .scoring import hex_report, score_hexes

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5")

SYSTEM = """You are GapMap's AI site-selection assistant. You help franchise operators find the best spot to open their next store in Sydney, Australia.

You have two tools:
  - filter_locations: use this first to translate the user's question into structured filters and fetch ranked candidate locations.
  - generate_insight: use this after filtering to narrate the top candidate with rich data-backed analysis.

Rules:
  1. Always call filter_locations first with the user's intent translated to vertical + optional locality.
  2. Available verticals: bubble_tea, coffee, fast_casual. Pick the closest match.
  3. Keep narration concise but data-rich (2-4 sentences). Cite concrete numbers: distances, competitor counts, anchor names.
  4. Do not invent data. Only reference values present in the tool output.
  5. If the user asks about "near universities" or "near transit", emphasize the anchor_pull and transit_proximity scores.
  6. Always mention the opportunity score and the single strongest driver (lowest competition, closest anchor, or best transit).
  7. If there's a cannibalization risk (same-brand store nearby), flag it as a warning.
"""


def _tools_schema() -> list[dict[str, Any]]:
    verticals = list(get_config()["verticals"].keys())
    return [
        {
            "name": "filter_locations",
            "description": (
                "Score and return top candidate hexes for a given F&B vertical in Sydney. "
                "Optionally filter by locality (e.g. 'inner west', 'Newtown') and a user "
                "brand_slug for cannibalization analysis."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "vertical": {
                        "type": "string",
                        "enum": verticals,
                        "description": "Franchise vertical the user is opening.",
                    },
                    "locality": {
                        "type": "string",
                        "description": (
                            "Optional. A suburb or area name to filter to (substring match "
                            "against locality). Examples: 'Newtown', 'Surry Hills', 'Parramatta'."
                        ),
                    },
                    "brand_slug": {
                        "type": "string",
                        "description": (
                            "Optional. The user's own brand (lowercase, no spaces) for "
                            "cannibalization distance. Examples: 'gongcha', 'chatime', 'rolld'."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max hexes to return. Default 5.",
                    },
                },
                "required": ["vertical"],
            },
        },
        {
            "name": "generate_insight",
            "description": (
                "Return a full report for a specific hex. Use this after filter_locations "
                "to narrate the top candidate with full data analysis."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "h3_id": {"type": "string"},
                    "vertical": {"type": "string", "enum": verticals},
                    "brand_slug": {"type": "string"},
                },
                "required": ["h3_id", "vertical"],
            },
        },
    ]


def _run_filter_locations(**kwargs) -> dict:
    vertical = kwargs["vertical"]
    locality = kwargs.get("locality")
    brand_slug = kwargs.get("brand_slug")
    limit = int(kwargs.get("limit") or 5)
    scores = score_hexes(vertical, brand_slug=brand_slug, locality_filter=locality)
    scores.sort(key=lambda s: -s.score)
    top = scores[:limit]
    return {
        "vertical": vertical,
        "locality": locality,
        "count": len(scores),
        "results": [
            {
                "h3_id": s.h3_id,
                "lat": s.lat,
                "lng": s.lng,
                "locality": s.locality,
                "score": s.score,
                "components": s.components,
                "n_competitors":  s.signals_raw["n_competitors"],
                "n_complementary": s.signals_raw["n_complementary"],
            }
            for s in top
        ],
    }


def _run_generate_insight(**kwargs) -> dict:
    return hex_report(kwargs["vertical"], kwargs["h3_id"], brand_slug=kwargs.get("brand_slug"))


TOOL_IMPLS = {
    "filter_locations": _run_filter_locations,
    "generate_insight": _run_generate_insight,
}


def chat(user_message: str, max_turns: int = 4) -> dict:
    """Run a user message through Claude with tool use.

    Returns:
      {
        "reply": str,                       # final assistant text
        "tool_calls": list[{name, input, output}],
        "highlight": {...} | None,          # top hex to focus the map on
      }
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or Anthropic is None:
        return _offline_fallback(user_message)

    client = Anthropic(api_key=api_key)
    tools = _tools_schema()
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_message}]
    tool_calls_log: list[dict[str, Any]] = []
    highlight: dict | None = None

    for _ in range(max_turns):
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM,
            tools=tools,
            messages=messages,
        )
        # Did the model call any tools?
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if not tool_uses:
            final_text = "\n".join(b.text for b in resp.content if b.type == "text").strip()
            return {
                "reply": final_text or "(no response)",
                "tool_calls": tool_calls_log,
                "highlight": highlight,
            }

        # Append the model turn, then one tool_result per tool_use
        messages.append({"role": "assistant", "content": resp.content})
        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            name = tu.name
            args = tu.input
            try:
                output = TOOL_IMPLS[name](**args)
                if name == "filter_locations" and output.get("results"):
                    highlight = output["results"][0]
            except Exception as exc:
                output = {"error": str(exc)}
            tool_calls_log.append({"name": name, "input": args, "output": output})
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": json.dumps(output, default=str)[:15000],
                }
            )
        messages.append({"role": "user", "content": tool_results})

    return {
        "reply": "(Maxed out tool turns without a final answer.)",
        "tool_calls": tool_calls_log,
        "highlight": highlight,
    }


# ─── Offline fallback (no API key) ───────────────────────────────────────────

# Comprehensive Sydney suburb list for better keyword matching
_SUBURBS = [
    "cbd", "sydney", "newtown", "surry hills", "bondi", "chatswood", "parramatta",
    "stanmore", "marrickville", "glebe", "ultimo", "redfern", "camperdown",
    "kingsford", "hurstville", "north sydney", "ashfield", "mascot",
    "randwick", "strathfield", "burwood", "inner west", "darlinghurst",
    "paddington", "chippendale", "haymarket", "broadway", "pyrmont",
    "manly", "mosman", "crows nest", "neutral bay", "lane cove",
    "ryde", "meadowbank", "eastwood", "epping", "macquarie park",
    "homebush", "auburn", "bankstown", "liverpool", "penrith",
    "blacktown", "castle hill", "hornsby", "dee why", "brookvale",
    "cronulla", "sutherland", "rockdale", "kogarah", "barangaroo",
    "waterloo", "zetland", "green square", "alexandria", "erskineville",
    "enmore", "leichhardt", "annandale", "petersham", "dulwich hill",
    "summer hill", "haberfield", "five dock", "drummoyne", "rozelle",
    "balmain", "hunters hill", "concord", "rhodes", "wentworth point",
    "wolli creek", "tempe", "sydenham", "st peters", "arncliffe",
]

# Anchor-type keywords the user might say
_ANCHOR_KEYWORDS = {
    "university": "is_anchor",
    "uni": "is_anchor",
    "universities": "is_anchor",
    "campus": "is_anchor",
    "college": "is_anchor",
    "school": "is_anchor",
    "mall": "is_anchor",
    "shopping": "is_anchor",
    "hospital": "is_anchor",
    "station": "is_transit",
    "train": "is_transit",
    "transit": "is_transit",
    "transport": "is_transit",
}


def _offline_fallback(user_message: str) -> dict:
    """Heuristic parsing so the demo works without an API key.

    Matches keywords to a vertical + optional locality, runs scoring,
    and returns a rich data-backed narration.
    """
    msg = user_message.lower()

    # Detect vertical
    vertical = "bubble_tea"
    for key, keywords in {
        "bubble_tea": ["bubble tea", "boba", "tea shop", "milk tea"],
        "coffee": ["coffee", "cafe", "café", "espresso", "latte"],
        "fast_casual": ["fast casual", "rolld", "roll'd", "soul origin", "fast food", "quick service", "qsr", "restaurant"],
    }.items():
        if any(k in msg for k in keywords):
            vertical = key
            break

    # Detect locality
    locality = None
    for hint in _SUBURBS:
        if hint in msg:
            # Map area aliases to actual suburbs
            if hint == "inner west":
                locality = None  # Don't filter, let scoring handle it naturally
            elif hint == "cbd":
                locality = "Sydney"
            else:
                locality = hint.title()
            break

    # Detect anchor preference (e.g. "near universities")
    anchor_preference = None
    for kw, col in _ANCHOR_KEYWORDS.items():
        if kw in msg:
            anchor_preference = col
            break

    # Score hexes
    out = _run_filter_locations(vertical=vertical, locality=locality, limit=10)

    # If user asked "near universities" etc., re-rank by anchor/transit distance
    results = out.get("results", [])
    if anchor_preference == "is_anchor" and results:
        # Re-rank: prefer hexes with highest anchor_pull score
        results.sort(key=lambda r: -r["components"].get("anchor_pull", 0))
        out["results"] = results[:5]
    elif anchor_preference == "is_transit" and results:
        results.sort(key=lambda r: -r["components"].get("transit_proximity", 0))
        out["results"] = results[:5]

    top = out["results"][0] if out["results"] else None

    if top:
        report = hex_report(vertical, top["h3_id"])
        anchor = report["nearest_anchors"][0] if report["nearest_anchors"] else None
        transit = report["nearest_transit"][0] if report["nearest_transit"] else None
        competitors = report["signals_raw"]["n_competitors"]
        diversity = report.get("diversity_index", 0)
        
        # Build rich narration
        area_name = top["locality"] or "unnamed area"
        vertical_name = vertical.replace("_", " ")
        
        parts = []
        parts.append(f"🏆 **Top match: {area_name}** — opportunity score **{top['score']}/100** for {vertical_name}.")
        
        # Competition
        if competitors == 0:
            parts.append(f"✅ **Zero direct competitors** within 500m — a true gap in the market.")
        elif competitors <= 2:
            parts.append(f"Low competition: only {competitors} competitor{'s' if competitors > 1 else ''} within 500m.")
        else:
            parts.append(f"⚠️ {competitors} competitors within 500m — moderate saturation.")
        
        # Anchor
        if anchor:
            parts.append(f"📍 Key anchor: **{anchor['name']}** is just {anchor['dist_m']}m away, driving foot traffic.")
        
        # Transit
        if transit:
            parts.append(f"🚉 Transit: {transit['name']} ({transit['dist_m']}m) supports repeat visits.")
        
        # Complementary
        n_complementary = report["signals_raw"]["n_complementary"]
        if n_complementary >= 3:
            comp_names = [c["name"] for c in report["nearest_complementary"][:2]]
            parts.append(f"🏪 {n_complementary} complementary businesses nearby including {', '.join(comp_names)}.")
        
        # Diversity
        if diversity >= 0.6:
            parts.append(f"📊 Area diversity index: {diversity} — vibrant commercial precinct.")
        
        # Cannibalization warning
        d_cannibal = report["signals_raw"].get("d_cannibal_m")
        if d_cannibal is not None and d_cannibal < 500:
            parts.append(f"⚠️ **Cannibalization risk**: same-brand store only {round(d_cannibal)}m away.")
        
        reply = "\n".join(parts)
    else:
        reply = "No matching locations found. Try broadening your search area or adjusting the vertical."

    return {
        "reply": reply,
        "tool_calls": [{"name": "filter_locations", "input": {"vertical": vertical, "locality": locality}, "output": out}],
        "highlight": top,
        "_offline": True,
    }
