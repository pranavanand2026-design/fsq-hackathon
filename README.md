# Branchwise

**AI-powered site selection for food and beverage operators.**

## Problem

Mid-size F&B brands (3–50 stores) make expansion decisions based on broker shortlists and gut feel. Enterprise location intelligence platforms exist but are priced and designed for analysts, not operators. There is no tool that gives a growing brand a fast, data-backed answer to: *where should we open next?*

## Solution

Branchwise scores every 300m zone across Sydney against five spatial signals derived from 233,000 real Foursquare place records. The result is a live heatmap of opportunity across 12,270 hex zones — ranked, explained, and queryable in plain English.

Ask a question. The AI adjusts the scoring weights to match your intent, rescores the entire city, and returns a specific location with a full breakdown.

## Architecture

```
Data Layer        233K Sydney POIs in a single Parquet file (Foursquare OS Places)
Scoring Engine    5 spatial signals per hex → normalised 0–100 → weighted opportunity score
API Layer         FastAPI — /heatmap · /report · /compare · /pins · /chat
AI Layer          Claude with tool-use — adjusts weights, searches, compares, explains
Frontend          React + deck.gl H3HexagonLayer + MapLibre
```

## Scoring Signals

| Signal | Weight | How computed |
|---|---|---|
| Surrounding activity | 40% | Anchor proximity + complementary venue density within 300m |
| Transit access | 30% | Haversine distance to nearest rail, bus, or ferry stop |
| Demographic match | 20% | Retail and F&B density within 300m as foot traffic proxy |
| Market saturation | 5% | Competitor count within 500m |
| Store overlap | 5% | Distance to nearest same-brand store |

## Stack

- **Backend:** FastAPI + DuckDB + Python
- **Frontend:** React + Vite + deck.gl + MapLibre + Zustand
- **AI:** Anthropic Claude with tool-use
- **Data:** Foursquare Open Source Places — 233K Sydney POIs

## Run

```bash
# Backend
source .venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

Add `ANTHROPIC_API_KEY` to a `.env` file in the repo root.
