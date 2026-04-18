import duckdb
import os

HF_TOKEN = os.environ.get("HF_TOKEN") or input("Paste your Hugging Face token: ").strip()

# Use single first-shard for places (to avoid scanning all 100 shards for a LIMIT 20)
PLACES_PATH    = "hf://datasets/foursquare/fsq-os-places/release/dt=2026-01-12/places/parquet/places-00000.zstd.parquet"
CATEGORIES_PATH = "hf://datasets/foursquare/fsq-os-places/release/dt=2026-01-12/categories/parquet/categories.zstd.parquet"

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
con.execute(f"CREATE OR REPLACE SECRET (TYPE huggingface, TOKEN '{HF_TOKEN}')")

# ── Schema ──────────────────────────────────────────────────────────────────
print("=" * 70)
print("PLACES TABLE — SCHEMA")
print("=" * 70)
places_schema = con.execute(f"DESCRIBE SELECT * FROM '{PLACES_PATH}' LIMIT 1").fetchall()
for row in places_schema:
    print(f"  {row[0]:<45} {row[1]}")

print()
print("=" * 70)
print("CATEGORIES TABLE — SCHEMA")
print("=" * 70)
cats_schema = con.execute(f"DESCRIBE SELECT * FROM '{CATEGORIES_PATH}' LIMIT 1").fetchall()
for row in cats_schema:
    print(f"  {row[0]:<45} {row[1]}")

# ── Sample rows ──────────────────────────────────────────────────────────────
print()
print("=" * 70)
print("SAMPLE ROWS — PLACES (20)")
print("=" * 70)
places_df = con.execute(f"SELECT * FROM '{PLACES_PATH}' LIMIT 20").fetchdf()
# Print each column on its own line per row for readability
for i, row in places_df.iterrows():
    print(f"\n--- Row {i+1} ---")
    for col in places_df.columns:
        val = row[col]
        # Truncate long values
        s = str(val)
        if len(s) > 120:
            s = s[:117] + "..."
        print(f"  {col}: {s}")

print()
print("=" * 70)
print("SAMPLE ROWS — CATEGORIES (20)")
print("=" * 70)
cats_df = con.execute(f"SELECT * FROM '{CATEGORIES_PATH}' LIMIT 20").fetchdf()
for i, row in cats_df.iterrows():
    print(f"\n--- Row {i+1} ---")
    for col in cats_df.columns:
        val = row[col]
        s = str(val)
        if len(s) > 120:
            s = s[:117] + "..."
        print(f"  {col}: {s}")

# ── Column classification ────────────────────────────────────────────────────
def classify_columns(schema_rows):
    geo, temporal, descriptive, ml_features = [], [], [], []
    geo_kw  = {"lat", "lng", "longitude", "latitude", "country", "region",
                "locality", "postcode", "address", "neighborhood", "geo",
                "bbox", "location", "admin", "postal", "place_type"}
    time_kw = {"date", "time", "created", "updated", "timestamp", "dt",
                "year", "month", "opened", "closed"}
    desc_kw = {"name", "category", "label", "type", "brand", "chain",
                "website", "phone", "email", "tel", "url", "description",
                "status", "hours", "amenity", "cuisine", "tag", "icon",
                "level", "parent"}
    for col, dtype, *_ in schema_rows:
        cl = col.lower()
        if any(k in cl for k in geo_kw):
            geo.append((col, dtype))
        if any(k in cl for k in time_kw):
            temporal.append((col, dtype))
        if any(k in cl for k in desc_kw):
            descriptive.append((col, dtype))
        if any(k in dtype.lower() for k in ("float", "double", "int", "bigint", "boolean", "bool")):
            ml_features.append((col, dtype))
        elif any(k in cl for k in ("id", "score", "rating", "count", "rank", "popularity")):
            ml_features.append((col, dtype))
    return geo, temporal, descriptive, ml_features

p_geo, p_temp, p_desc, p_ml = classify_columns(places_schema)
c_geo, c_temp, c_desc, c_ml = classify_columns(cats_schema)

# ── Summary ──────────────────────────────────────────────────────────────────
print()
print("=" * 70)
print("SUMMARY")
print("=" * 70)

for label, schema, geo, temporal, descriptive, ml_features in [
    ("PLACES", places_schema, p_geo, p_temp, p_desc, p_ml),
    ("CATEGORIES", cats_schema, c_geo, c_temp, c_desc, c_ml),
]:
    print(f"\n[{label}]")
    print(f"  Total columns : {len(schema)}")
    print(f"  Geographic    : {[c for c,_ in geo] or '(none)'}")
    print(f"  Temporal      : {[c for c,_ in temporal] or '(none)'}")
    print(f"  Descriptive   : {[c for c,_ in descriptive] or '(none)'}")
    print(f"  ML features   : {[c for c,_ in ml_features] or '(none)'}")

# ── Markdown file ────────────────────────────────────────────────────────────
md = []
md.append("# Foursquare OS Places — Dataset Overview\n")
md.append(f"**Release date:** `2026-01-12`  ")
md.append(f"**Dataset:** `foursquare/fsq-os-places`\n")

for label, schema, geo, temporal, descriptive, ml_features, path in [
    ("Places",     places_schema,  p_geo, p_temp, p_desc, p_ml, PLACES_PATH),
    ("Categories", cats_schema,    c_geo, c_temp, c_desc, c_ml, CATEGORIES_PATH),
]:
    md.append(f"---\n## {label} Table\n")
    md.append(f"**Path:** `{path}`  ")
    md.append(f"**Total columns:** {len(schema)}\n")

    md.append("### Full Schema\n")
    md.append("| Column | Type |")
    md.append("|--------|------|")
    for col, dtype, *_ in schema:
        md.append(f"| `{col}` | `{dtype}` |")

    def section(title, items):
        md.append(f"\n### {title}")
        if items:
            for col, dtype in items:
                md.append(f"- `{col}` (`{dtype}`)")
        else:
            md.append("- *(none detected)*")

    section("Geographic Columns (lat/lng, country, region, etc.)", geo)
    section("Temporal Columns (dates, timestamps)", temporal)
    section("Descriptive Columns (name, category, address, etc.)", descriptive)
    section("Potential ML / Analytics Feature Columns", ml_features)
    md.append("")

md_content = "\n".join(md)

with open("dataset_overview.md", "w") as f:
    f.write(md_content)

print("\nSaved to dataset_overview.md")
