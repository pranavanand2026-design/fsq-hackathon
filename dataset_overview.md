# Foursquare OS Places — Dataset Overview

**Release date:** `2026-01-12`  
**Dataset:** `foursquare/fsq-os-places`

---
## Places Table

**Path:** `hf://datasets/foursquare/fsq-os-places/release/dt=2026-01-12/places/parquet/places-00000.zstd.parquet`  
**Total columns:** 28

### Full Schema

| Column | Type |
|--------|------|
| `fsq_place_id` | `VARCHAR` |
| `name` | `VARCHAR` |
| `latitude` | `DOUBLE` |
| `longitude` | `DOUBLE` |
| `address` | `VARCHAR` |
| `locality` | `VARCHAR` |
| `region` | `VARCHAR` |
| `postcode` | `VARCHAR` |
| `admin_region` | `VARCHAR` |
| `post_town` | `VARCHAR` |
| `po_box` | `VARCHAR` |
| `country` | `VARCHAR` |
| `date_created` | `VARCHAR` |
| `date_refreshed` | `VARCHAR` |
| `date_closed` | `VARCHAR` |
| `tel` | `VARCHAR` |
| `website` | `VARCHAR` |
| `email` | `VARCHAR` |
| `facebook_id` | `BIGINT` |
| `instagram` | `VARCHAR` |
| `twitter` | `VARCHAR` |
| `fsq_category_ids` | `VARCHAR[]` |
| `fsq_category_labels` | `VARCHAR[]` |
| `placemaker_url` | `VARCHAR` |
| `unresolved_flags` | `VARCHAR[]` |
| `geom` | `BLOB` |
| `bbox` | `STRUCT(xmin DOUBLE, ymin DOUBLE, xmax DOUBLE, ymax DOUBLE)` |
| `dt` | `DATE` |

### Geographic Columns (lat/lng, country, region, etc.)
- `latitude` (`DOUBLE`)
- `longitude` (`DOUBLE`)
- `address` (`VARCHAR`)
- `locality` (`VARCHAR`)
- `region` (`VARCHAR`)
- `postcode` (`VARCHAR`)
- `admin_region` (`VARCHAR`)
- `country` (`VARCHAR`)
- `geom` (`BLOB`)
- `bbox` (`STRUCT(xmin DOUBLE, ymin DOUBLE, xmax DOUBLE, ymax DOUBLE)`)

### Temporal Columns (dates, timestamps)
- `date_created` (`VARCHAR`)
- `date_refreshed` (`VARCHAR`)
- `date_closed` (`VARCHAR`)
- `dt` (`DATE`)

### Descriptive Columns (name, category, address, etc.)
- `name` (`VARCHAR`)
- `tel` (`VARCHAR`)
- `website` (`VARCHAR`)
- `email` (`VARCHAR`)
- `instagram` (`VARCHAR`)
- `fsq_category_ids` (`VARCHAR[]`)
- `fsq_category_labels` (`VARCHAR[]`)
- `placemaker_url` (`VARCHAR`)

### Potential ML / Analytics Feature Columns
- `fsq_place_id` (`VARCHAR`)
- `latitude` (`DOUBLE`)
- `longitude` (`DOUBLE`)
- `country` (`VARCHAR`)
- `facebook_id` (`BIGINT`)
- `fsq_category_ids` (`VARCHAR[]`)
- `bbox` (`STRUCT(xmin DOUBLE, ymin DOUBLE, xmax DOUBLE, ymax DOUBLE)`)

---
## Categories Table

**Path:** `hf://datasets/foursquare/fsq-os-places/release/dt=2026-01-12/categories/parquet/categories.zstd.parquet`  
**Total columns:** 17

### Full Schema

| Column | Type |
|--------|------|
| `category_id` | `VARCHAR` |
| `category_level` | `INTEGER` |
| `category_name` | `VARCHAR` |
| `category_label` | `VARCHAR` |
| `level1_category_id` | `VARCHAR` |
| `level1_category_name` | `VARCHAR` |
| `level2_category_id` | `VARCHAR` |
| `level2_category_name` | `VARCHAR` |
| `level3_category_id` | `VARCHAR` |
| `level3_category_name` | `VARCHAR` |
| `level4_category_id` | `VARCHAR` |
| `level4_category_name` | `VARCHAR` |
| `level5_category_id` | `VARCHAR` |
| `level5_category_name` | `VARCHAR` |
| `level6_category_id` | `VARCHAR` |
| `level6_category_name` | `VARCHAR` |
| `dt` | `DATE` |

### Geographic Columns (lat/lng, country, region, etc.)
- *(none detected)*

### Temporal Columns (dates, timestamps)
- `dt` (`DATE`)

### Descriptive Columns (name, category, address, etc.)
- `category_id` (`VARCHAR`)
- `category_level` (`INTEGER`)
- `category_name` (`VARCHAR`)
- `category_label` (`VARCHAR`)
- `level1_category_id` (`VARCHAR`)
- `level1_category_name` (`VARCHAR`)
- `level2_category_id` (`VARCHAR`)
- `level2_category_name` (`VARCHAR`)
- `level3_category_id` (`VARCHAR`)
- `level3_category_name` (`VARCHAR`)
- `level4_category_id` (`VARCHAR`)
- `level4_category_name` (`VARCHAR`)
- `level5_category_id` (`VARCHAR`)
- `level5_category_name` (`VARCHAR`)
- `level6_category_id` (`VARCHAR`)
- `level6_category_name` (`VARCHAR`)

### Potential ML / Analytics Feature Columns
- `category_id` (`VARCHAR`)
- `category_level` (`INTEGER`)
- `level1_category_id` (`VARCHAR`)
- `level2_category_id` (`VARCHAR`)
- `level3_category_id` (`VARCHAR`)
- `level4_category_id` (`VARCHAR`)
- `level5_category_id` (`VARCHAR`)
- `level6_category_id` (`VARCHAR`)
