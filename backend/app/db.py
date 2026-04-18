"""DuckDB connection + helpers for Sydney POI dataset."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_PARQUET = ROOT / "data" / "sydney_pois.parquet"
CATEGORIES_JSON = ROOT / "config" / "categories.json"

_con: duckdb.DuckDBPyConnection | None = None


def get_con() -> duckdb.DuckDBPyConnection:
    global _con
    if _con is not None:
        return _con

    if not DATA_PARQUET.exists():
        raise FileNotFoundError(
            f"Missing {DATA_PARQUET}. Run: python scripts/prepare_sydney.py"
        )

    con = duckdb.connect()
    con.execute(
        f"""
        CREATE VIEW pois AS
        SELECT *
        FROM read_parquet('{DATA_PARQUET}')
        """
    )
    _con = con
    return con


@lru_cache(maxsize=1)
def get_config() -> dict:
    with CATEGORIES_JSON.open() as f:
        return json.load(f)


def get_vertical(key: str) -> dict:
    cfg = get_config()
    if key not in cfg["verticals"]:
        raise KeyError(f"Unknown vertical: {key}")
    return cfg["verticals"][key]
