# GapMap — Product & Technical Plan

> **One-line pitch:** AI-powered site selection for SMB F&B franchisees — "GapMaps for the franchisee who can't afford GapMaps."
>
> **Status:** Working MVP. FastAPI + DuckDB backend, React + deck.gl frontend, Claude tool-use chat with offline fallback.
>
> **Audience for this doc:** new team members, judges who want to dig in, and any AI coding agent picking up the repo mid-build. Read it before editing code.

---

## 1. Hackathon context

- **Event:** SUDATA × COMMS-STEM Hackathon 2026 @ USyd
- **Theme:** Location intelligence product using Foursquare OS Places (100M+ POIs)
- **Marking:** Commercial Feasibility 20% · Pitch 20% · Product Design 15% · Data Strategy 15% · Technical Execution 15% · Innovation 15%
- **Our bet:** business framing + pitch polish = 40% of marks; ship a working, polished demo instead of feature sprawl

---

## 2. Product

### 2.1 Who & why

**Target user:** Mid-tier F&B franchise operator expanding in Sydney (brands like Gong Cha, Roll'd, Soul Origin, Chatime — 10–100 stores).

**Problem:** They spend $200–500K opening a new store and currently choose sites by driving around. F&B has the highest failure rate of any industry (8.2%) with wrong location the #1 cause. Enterprise tools (SiteZeus $20K+/yr, GapMaps, Placer.ai) are priced for Fortune 500.

**Our wedge:** Deliver 80% of the insight at $0. Pure FSQ data, no paid enrichment, positioned as "the Canva of site selection."

### 2.2 Three screens

1. **Map + sidebar** — H3 hex heatmap, competitor/complementary pins, layer toggles, vertical picker, AI chat bar
2. **Report panel** — slides in on hex click; shows score /100, 5 component bars, nearest POIs, drill-down lists
3. **Compare mode** — side-by-side cards for 2–3 pinned hexes

### 2.3 Demo flow (3 min — rehearse exactly)

1. **Hook** (20s): "F&B fails at 8.2% — the highest of any industry. #1 cause is wrong location. SMB franchisees can't afford the $20K tools. We built GapMap."
2. **Map** (30s): Pick bubble tea, brand `gongcha` — 12K hexes light up green→amber→red across Sydney.
3. **AI chat** (45s — the wow moment): Type *"Where should I open a bubble tea near universities in the inner west?"* — map flies to Stanmore/Newtown, hex highlights, score 90/100, anchor "University of Sydney 141m away", "zero competitors within 500m".
4. **Compare** (30s): Pin Newtown, click a Haymarket hex (67/100, 8 competitors), hit **Compare** — side-by-side delta.
5. **Innovation beat** (20s): "**Cannibalization distance** — distance to nearest same-brand store. Critical for franchisees. No competitor offers this at the SMB tier."
6. **Close** (15s): "$20K tools, delivered at $0. 1,300 AU franchise networks, $174B market."

---

## 3. Scoring algorithm

5 signals, **all from Foursquare alone** — no external enrichment. Weights sum to 100.

| Signal | Weight | What it measures | Direction |
|---|---|---|---|
| `competition_density` | 25% | Direct competitors within 500m | Fewer = higher |
| `anchor_pull` | 25% | Distance to nearest anchor (uni, mall, hospital, transit hub) | Closer = higher |
| `foot_traffic_proxy` | 20% | Retail + F&B POI density within 300m | More = higher |
| `transit_proximity` | 15% | Distance to nearest FSQ transit POI (Rail/Bus Station) | Closer = higher |
| `cannibalization` | 15% | Distance to nearest same-brand store | Farther = higher |

**Tuning thresholds** live in [`backend/app/scoring.py`](backend/app/scoring.py) under `PARAMS`. Key values:

| Param | Value | Rationale |
|---|---|---|
| `competitor_radius_m` | 500 | Walking range for F&B |
| `competitor_saturation` | 8 | ≥8 competitors within 500m → score 0 |
| `anchor_full_score_m` | 400 | ≤400m from anchor → 100 |
| `anchor_zero_m` | 2500 | ≥2500m → 0 |
| `foot_traffic_saturation` | 40 | ≥40 retail/F&B within 300m → 100 |
| `transit_full_score_m` / `transit_zero_m` | 300 / 1500 | |
| `cannibal_full_score_m` / `cannibal_zero_m` | 1500 / 200 | Below 200m = definitely eating your own store |

Normalization is piecewise-linear with hard clamps to [0, 100]. If you tune, re-verify the score distribution should have a visible spread across Sydney (currently: ~1% in 90+, ~35% in 75–89, ~55% in 50–74, ~7% in 25–49).

---

## 4. Data

### 4.1 Pipeline

```
huggingface.co/foursquare/fsq-os-places   ──┐
 (release dt=2026-01-12, 100M+ POIs global) │
                                            ▼
                 scripts/prepare_sydney.py  (filters + H3 + brand_slug)
                                            │
                                            ▼
                 data/sydney_pois.parquet   (~233K real or ~12K synthetic)
                                            │
                                            ▼
                 DuckDB view `pois`         (loaded at backend startup)
```

**Filter:** `country='AU' AND latitude BETWEEN -34.1 AND -33.6 AND longitude BETWEEN 150.8 AND 151.35 AND date_closed IS NULL`

Gives **~233,345 open Sydney POIs** across **12,270 H3 res-9 hexes**.

### 4.2 Derived columns (added in prep script)

- `h3_9`: H3 cell at res 9 (~300m edge hex) — primary spatial index
- `primary_category`: last segment of first `fsq_category_labels` entry, trimmed
- `brand_slug`: `LOWER(REGEXP_REPLACE(name, '[^A-Za-z]', ''))[1:18]` — normalized token for cannibalization match. Examples: `"Gong Cha"` → `gongcha`, `"Chatime"` → `chatime`, `"7-Eleven"` → `eleven`, `"McDonald's"` → `mcdonalds`.

### 4.3 Category mapping

Config file: [`config/categories.json`](config/categories.json).

**Important:** real FSQ `primary_category` values look like `Café`, `Cafe, Coffee, and Tea House`, `Rail Station`, `College and University`, `Shopping Mall` — **not** the plain names a human would guess. All matching in scoring.py is exact (`LOWER(a) = LOWER(b)`), so the config must list the actual FSQ taxonomy strings.

Verticals shipped: `bubble_tea`, `coffee`, `fast_casual`. To add one, update `config/categories.json` with `competitors`/`complementary`/`anchors` arrays of real FSQ category names.

### 4.4 What we **don't** have (honest framing for judges)

- Foot traffic (use retail density proxy instead)
- Demographics (would come from ABS census — Phase 2)
- Opening hours / revenue
- Drive-time isochrones (radius is circular)

---

## 5. Architecture

```
┌─────────────────────────┐           ┌─────────────────────────┐
│  frontend (Vite :5173)  │ ──/api──▶ │  backend (FastAPI :8000)│
│  React + deck.gl        │           │  DuckDB + parquet       │
│  MapLibre GL + Carto    │           │  Anthropic SDK          │
│  Zustand store          │           │                         │
└─────────────────────────┘           └─────────────────────────┘
           │                                     │
           │                                     ▼
           │                      ┌──────────────────────────┐
           │                      │ data/sydney_pois.parquet │
           │                      │ config/categories.json   │
           │                      └──────────────────────────┘
           │
           ▼
   user browses Sydney
```

### 5.1 Backend (FastAPI)

| File | Role |
|---|---|
| [`backend/app/main.py`](backend/app/main.py) | FastAPI app, CORS, endpoints |
| [`backend/app/db.py`](backend/app/db.py) | DuckDB connection, loads parquet as view `pois`, reads config |
| [`backend/app/scoring.py`](backend/app/scoring.py) | Scoring engine. `score_hexes()`, `hex_report()`, all SQL |
| [`backend/app/claude_chat.py`](backend/app/claude_chat.py) | Claude tool-use bridge + offline keyword-based fallback |

**Runs:** `uvicorn backend.app.main:app --reload --port 8000`

**Env (optional):**
- `ANTHROPIC_API_KEY` — enables live Claude chat (falls back to offline heuristic if missing)
- `HF_TOKEN` — enables real FSQ data download in prep script
- `CLAUDE_MODEL` — defaults to `claude-sonnet-4-5`

### 5.2 Frontend (Vite + React + TS)

| File | Role |
|---|---|
| [`frontend/src/App.tsx`](frontend/src/App.tsx) | Layout shell; mounts sidebar, map, report, compare, chat |
| [`frontend/src/components/MapView.tsx`](frontend/src/components/MapView.tsx) | MapLibre + deck.gl H3HexagonLayer + pin scatterplots |
| [`frontend/src/components/Sidebar.tsx`](frontend/src/components/Sidebar.tsx) | Vertical picker, brand input, layer toggles, pinned list |
| [`frontend/src/components/ReportPanel.tsx`](frontend/src/components/ReportPanel.tsx) | Right slide-out: score, bars, nearest POIs |
| [`frontend/src/components/CompareMode.tsx`](frontend/src/components/CompareMode.tsx) | Full-screen compare overlay |
| [`frontend/src/components/ChatBar.tsx`](frontend/src/components/ChatBar.tsx) | AI chat with starter prompts + loading states |
| [`frontend/src/components/ScoreBar.tsx`](frontend/src/components/ScoreBar.tsx) | Animated framer-motion score bar |
| [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) | Typed fetch wrappers |
| [`frontend/src/lib/store.ts`](frontend/src/lib/store.ts) | Zustand global state |
| [`frontend/src/lib/colors.ts`](frontend/src/lib/colors.ts) | Score → colour mapping |

**Runs:** `cd frontend && npm run dev` (proxies `/api` → backend :8000)

**Design system:**
- Dark only. Base `#0B0E14`, panel `#141922`, border `#262E3D`
- Accent emerald `#10B981`. Score scale: green `#10B981` (≥75) → amber `#F59E0B` (50–74) → red `#EF4444` (<50)
- Inter font, tabular numerals for scores. All numbers use `.tabular` class.
- Animations: framer-motion spring (stiffness 340, damping 30) for panels; 300–500ms ease-out for bars

---

## 6. API contract

All request/response types are in [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) — keep in sync with [`backend/app/main.py`](backend/app/main.py).

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok, poi_count }` |
| GET | `/api/verticals` | — | `{ verticals: Vertical[] }` |
| POST | `/api/heatmap` | `{ vertical, brand_slug?, locality? }` | `{ vertical, count, hexes: HexResult[] }` |
| POST | `/api/report` | `{ vertical, h3_id, brand_slug? }` | `HexReport` |
| POST | `/api/compare` | `{ vertical, h3_ids, brand_slug? }` | `{ reports: HexReport[] }` |
| GET | `/api/pins` | `?vertical&min_lat&max_lat&min_lng&max_lng&limit` | `{ pins: Pin[] }` |
| POST | `/api/chat` | `{ message }` | `ChatResponse` |

### 6.1 Claude tool schema (`/api/chat`)

Two tools, both deterministic — Claude cannot write raw SQL:

1. **`filter_locations`** — `{vertical, locality?, brand_slug?, limit?}` → ranked hex list
2. **`generate_insight`** — `{h3_id, vertical, brand_slug?}` → full report

Narration is capped at 2–3 sentences with one concrete driver (distance, count) and one risk if present. System prompt is in [`backend/app/claude_chat.py`](backend/app/claude_chat.py).

**Offline fallback:** if `ANTHROPIC_API_KEY` is missing, `_offline_fallback()` parses the message with keyword matching (bubble tea / coffee / fast casual + known suburb names) and runs the same scoring → returns a hand-crafted narration. UI surfaces a small "Offline mode" badge.

---

## 7. Running from scratch

```bash
# Python deps (once)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Data (once, or re-run to refresh)
export HF_TOKEN=hf_...                              # optional; synthetic fallback works without
python scripts/prepare_sydney.py

# Node deps (once)
cd frontend && npm install && cd ..

# Run
# Terminal 1:
uvicorn backend.app.main:app --reload --port 8000

# Terminal 2:
cd frontend && npm run dev
# open http://localhost:5173
```

Optional `.env` at repo root:

```
HF_TOKEN=hf_...
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-5
```

---

## 8. Hour-by-hour build split (team of 4)

Assumes ~12 productive hours.

**Pre-hackathon Friday night (non-negotiable):**
- Run `prepare_sydney.py` with HF_TOKEN
- Verify POI count, top categories
- Curate `config/categories.json` for your verticals
- Everyone clones + installs deps

**H 0–1:** scope lock, API contract freeze
**H 1–4 (parallel):**
- Backend+data (1): scoring tuning, `/heatmap`, `/report`
- Frontend (1): map + heatmap + sidebar
- Data+domain (1): verify categories, spot-check 10 suburbs
- Pitch (1): deck slides 1–4

**H 4–7:**
- Backend: Claude chat + `/compare`
- Frontend: report panel + chat bar + compare mode
- Pitch: slides 5–8, demo rehearsal

**H 7–10:** polish, QA, fix scoring bugs, rehearse demo 5×
**H 10–12:** smoke tests, backup recording, buffer

---

## 9. Known edge cases / non-goals

- **Non-goal:** drive-time isochrones (radius is circular). Fine for dense urban Sydney.
- **Non-goal:** demographics / census data. Phase 2.
- **Non-goal:** authentication, multi-user, deployment. Everything runs locally for demo.
- **Non-goal:** foot traffic from visits. We use POI density as a proxy and disclose it honestly.
- **Edge case:** hexes with no `locality` (e.g. mid-water) are labelled "Sydney Area" in the UI.
- **Edge case:** real FSQ has `None` primary_category for ~10% of rows (generic parent categories). These don't affect scoring since we only match on named categories.

---

## 10. For AI agents editing this repo

Before coding, read this whole file. Then:

1. **Don't add features outside the plan.** The scope is locked. If asked to add something not listed, push back first.
2. **Categories live in `config/categories.json`** — do not hardcode FSQ category names elsewhere.
3. **Scoring parameters live in `PARAMS` in `scoring.py`** — tune there, not in random code.
4. **API types live in `frontend/src/lib/api.ts`** — update both ends when changing the contract.
5. **Dark theme only.** All Tailwind colours use the semantic tokens in `tailwind.config.js` (`bg-bg-panel`, `text-fg-primary`, `text-accent`). Don't introduce raw hex in JSX except inline style for dynamic colours (score bars, map layers).
6. **Numbers use `.tabular` class** (tabular-nums) to prevent jitter.
7. **Framer-motion for all panel entry/exit** — spring, stiffness 340, damping 30. Bars use 400–500ms ease-out.
8. **Claude chat uses tool-use, not raw text-to-SQL.** Adding a third tool? Register it in both `_tools_schema()` and `TOOL_IMPLS` in `claude_chat.py`.
9. **Every API call in the frontend goes through `lib/api.ts`.** Don't `fetch()` inline.
10. **Synthetic fallback must keep working.** If `HF_TOKEN` is unset, the app must still demo. Test with it unset before shipping.

## 11. What would break the demo (guard against)

- Claude API latency > 3s during live chat → we have offline fallback so it never blocks
- Deck.gl not rendering 12K hexes → verified, runs fine at 60fps
- Someone edits `categories.json` without knowing real FSQ names → scoring silently goes to zero. If that happens, check `primary_category` values in parquet with a one-liner DuckDB query.
- Laptop battery dying mid-demo → backup: record a 60s screen capture after final polish
