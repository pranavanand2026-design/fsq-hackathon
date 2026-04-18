# Instructions for AI coding agents

**Read [`PLAN.md`](PLAN.md) first.** It covers product vision, scoring algorithm, data pipeline, architecture, and API contract. Do not edit code without that context.

## Quick facts

- **Stack:** FastAPI + DuckDB (backend) · React + Vite + deck.gl + MapLibre (frontend) · Anthropic SDK (chat)
- **Data:** ~233K real Sydney POIs from Foursquare OS Places, indexed by H3 res-9 hexagons (~300m edge)
- **Config:** all category matching lives in `config/categories.json`; all scoring thresholds in `PARAMS` dict in `backend/app/scoring.py`

## Run

```bash
# Backend
source .venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm run dev
```

Optional `.env` in repo root: `HF_TOKEN`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`.

## Critical rules

1. **Never hardcode FSQ category names outside `config/categories.json`.** Real FSQ values look like `"Café"`, `"Cafe, Coffee, and Tea House"`, `"Rail Station"`, `"College and University"` — not what a human would guess. Check the actual taxonomy with:
   ```bash
   .venv/bin/python -c "import duckdb; [print(r) for r in duckdb.connect().execute(\"SELECT primary_category, COUNT(*) FROM read_parquet('data/sydney_pois.parquet') GROUP BY 1 ORDER BY 2 DESC LIMIT 30\").fetchall()]"
   ```

2. **API types live in `frontend/src/lib/api.ts`** — if you change a response shape in `main.py`, update the TypeScript type in the same commit.

3. **Dark theme only.** Use Tailwind semantic tokens (`bg-bg-panel`, `text-fg-primary`, `text-accent`). Only use raw hex in inline style for dynamic colours (score-based fills).

4. **Numbers use `.tabular` class** to prevent jitter when values change.

5. **Every frontend API call goes through `lib/api.ts`.** Don't inline `fetch()` in components.

6. **Claude uses tool-use, not raw text-to-SQL.** Tools live in `backend/app/claude_chat.py` — to add one, register it in both `_tools_schema()` and `TOOL_IMPLS`.

7. **Synthetic fallback must keep working.** Unset `HF_TOKEN`, run the prep script, then the full app, and confirm the demo flow still works end-to-end.

8. **Don't scope-creep.** The MVP is fixed (see PLAN.md §2). If the user asks for something outside, surface the tradeoff before building.

## Where to change what

| Change | File |
|---|---|
| Add a vertical | `config/categories.json` |
| Tune scoring weights or thresholds | `PARAMS` / `WEIGHTS` in `backend/app/scoring.py` |
| Change score → colour mapping | `frontend/src/lib/colors.ts` |
| Add an API endpoint | `backend/app/main.py` + `frontend/src/lib/api.ts` |
| Add a Claude tool | `backend/app/claude_chat.py` (both `_tools_schema` and `TOOL_IMPLS`) |
| Edit the system prompt | `SYSTEM` constant in `backend/app/claude_chat.py` |
| Change design tokens | `frontend/tailwind.config.js` |
| Change initial map view | `INITIAL_VIEW` in `frontend/src/components/MapView.tsx` |

## Verifying a change

Before calling a change done:

```bash
# Backend still imports
.venv/bin/python -c "from backend.app.main import app; print('ok')"

# Frontend type-checks + builds
cd frontend && npm run build

# Endpoints still live (backend must be running)
curl -s http://127.0.0.1:8000/api/health
curl -s -X POST http://127.0.0.1:8000/api/heatmap -H 'Content-Type: application/json' -d '{"vertical":"bubble_tea","brand_slug":"gongcha"}' | head -c 200
```

## Demo flow (must not break)

1. Open http://localhost:5173
2. Default vertical = `bubble_tea`, brand = `gongcha`
3. Hexes load and colour across Sydney
4. Type in chat: "Where should I open bubble tea near universities?"
5. Map flies to top result, report slides in
6. Pin it, click a competing hex (e.g. Haymarket), hit Compare
7. Compare overlay shows side-by-side cards

If any step above fails, that's a ship-blocker.
