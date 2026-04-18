# FSQ OS Places — Hackathon Analysis

Exploring the [Foursquare Open Source Places](https://huggingface.co/datasets/foursquare/fsq-os-places) dataset (100M+ global POIs).

## Setup

```bash
pip install duckdb huggingface_hub
```

## Access

1. Accept the dataset terms at https://huggingface.co/datasets/foursquare/fsq-os-places
2. Get a HuggingFace token from https://huggingface.co/settings/tokens
3. Set your token:

```bash
export HF_TOKEN=hf_...
```

Or just run the script — it will prompt you if the env var isn't set.

## Run

```bash
python explore_fsq.py
```

This will:
- Print the full schema of the `places` and `categories` tables
- Show 20 sample rows from each
- Print a column summary (geo, temporal, descriptive, ML features)
- Save a `dataset_overview.md`

## Dataset paths (release `dt=2026-01-12`)

| Table | Path |
|-------|------|
| Places | `hf://datasets/foursquare/fsq-os-places/release/dt=2026-01-12/places/parquet/places-00000.zstd.parquet` (100 shards total) |
| Categories | `hf://datasets/foursquare/fsq-os-places/release/dt=2026-01-12/categories/parquet/categories.zstd.parquet` |
