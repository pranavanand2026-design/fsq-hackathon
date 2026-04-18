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

SYSTEM = """You are GapMap's AI site-selection assistant. You help franchise operators find the best spot to open their next store in Sydney.

You have two tools:
  - filter_locations: use this first to translate the user's question into structured filters and fetch ranked candidate locations.
  - generate_insight: use this after filtering to narrate a short recommendation.

Rules:
  1. Always call filter_locations first with the user's intent translated to vertical + optional locality.
  2. Available verticals: bubble_tea, coffee, fast_casual. Pick the closest match.
  3. Keep narration concise (2-3 sentences). Cite one concrete driver (e.g. "within 300m of University of Sydney") and one risk if present.
  4. Do not invent data. Only reference values present in the tool output.
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
                "to narrate the top candidate."
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

def _offline_fallback(user_message: str) -> dict:
    """Heuristic parsing so the demo works without an API key.

    Matches simple keywords to a vertical + optional locality, runs scoring
    deterministically, and returns a canned narration.
    """
    msg = user_message.lower()

    vertical = "bubble_tea"
    for key, keywords in {
        "bubble_tea": ["bubble tea", "boba", "tea"],
        "coffee": ["coffee", "cafe", "café", "espresso"],
        "fast_casual": ["fast casual", "rolld", "roll'd", "soul origin", "fast food", "quick"],
    }.items():
        if any(k in msg for k in keywords):
            vertical = key
            break

    # Very crude locality extraction — match any suburb name we have in the data
    locality = None
    for hint in [
        "cbd", "newtown", "surry hills", "bondi", "chatswood", "parramatta",
        "stanmore", "marrickville", "glebe", "ultimo", "redfern", "camperdown",
        "kingsford", "hurstville", "north sydney", "ashfield", "mascot",
        "randwick", "strathfield", "burwood", "inner west",
    ]:
        if hint in msg:
            locality = "Newtown" if hint == "inner west" else hint.title()
            break

    out = _run_filter_locations(vertical=vertical, locality=locality, limit=5)
    top = out["results"][0] if out["results"] else None

    if top:
        report = hex_report(vertical, top["h3_id"])
        anchor = report["nearest_anchors"][0] if report["nearest_anchors"] else None
        competitors = report["signals_raw"]["n_competitors"]
        drivers = []
        if anchor:
            drivers.append(f"{anchor['dist_m']}m from {anchor['name']}")
        if competitors == 0:
            drivers.append("zero direct competitors within 500m")
        elif competitors <= 2:
            drivers.append(f"only {competitors} direct competitor(s) within 500m")
        driver_text = "; ".join(drivers) or "strong foot-traffic density"
        reply = (
            f"Top match: **{top['locality'] or 'unnamed area'}** — opportunity score "
            f"{top['score']}/100 for {vertical.replace('_', ' ')}. "
            f"Key driver: {driver_text}. "
            + (f"Watch out: {competitors} competitors already within 500m." if competitors > 4 else "")
        ).strip()
    else:
        reply = "No matching locations found. Try a broader area."

    return {
        "reply": reply,
        "tool_calls": [{"name": "filter_locations", "input": {"vertical": vertical, "locality": locality}, "output": out}],
        "highlight": top,
        "_offline": True,
    }
