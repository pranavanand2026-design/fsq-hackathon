# GapMap — AI-powered site selection for franchise operators

> "GapMaps for the franchisee who can't afford GapMaps."

**Stack:** FastAPI + DuckDB + Foursquare OS Places · React + Vite + deck.gl · Claude API

---

## Quick start (2 terminals)

### 1. Backend

```bash
# First time only
python3 -m venv .venv
pip install -r requirements.txt
python scripts/prepare_sydney.py      # generates data/sydney_pois.parquet

# Every time
source .venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install       # first time only
npm run dev       # http://localhost:5173
```

---

## Environment variables (optional)

Create `.env` in the repo root:

```
ANTHROPIC_API_KEY=sk-ant-...   # enables Claude chat (without it: smart offline fallback)
HF_TOKEN=hf_...                # enables real FSQ data download
CLAUDE_MODEL=claude-sonnet-4-5 # override model
```

---

## Data

| Source | What | Why |
|--------|------|-----|
| Foursquare OS Places | 11,859 Sydney POIs (synthetic) or 200-500K real | All 5 scoring signals |
| H3 resolution 9 | ~300m hexagons | Grid for opportunity scoring |

Run with real FSQ data:
```bash
export HF_TOKEN=hf_your_token
python scripts/prepare_sydney.py
```

---

## Scoring algorithm (5 signals, all from Foursquare)

| Signal | Weight | Formula |
|--------|--------|---------|
| Competition density | 25% | Fewer direct competitors within 500m → higher |
| Anchor pull | 25% | Closer to uni / mall / hospital → higher |
| Foot-traffic proxy | 20% | More retail+F&B POIs within 300m → higher |
| Transit proximity | 15% | Closer to FSQ transit POI → higher |
| Cannibalization distance | 15% | Farther from nearest same-brand → higher |

---

## Demo script (3 min)

1. Select **Bubble Tea** vertical, brand slug `gongcha`
2. Type in chat: *"Where should I open a bubble tea near universities in the inner west?"*
3. Map recolors → click best hex → report slides in
4. Pin location → click Surry Hills hex → **Compare**
5. Show cannibalization distance beat

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness + POI count |
| GET | `/api/verticals` | Available verticals |
| POST | `/api/heatmap` | Score all hexes for a vertical |
| POST | `/api/report` | Full report for one hex |
| POST | `/api/compare` | Compare 2–3 hexes |
| GET | `/api/pins` | Competitor/complementary pins in bbox |
| POST | `/api/chat` | Claude tool-use chat |
