# SkillBridge — System Architecture

## 1. High-level diagram

```text
┌────────────────────────── DATA SOURCES ──────────────────────────┐
│  O*NET 31.0      BLS OEWS       AIOE        GPTs-are-GPTs        │
│  (SQL/CSV)       (XLSX/API)     (CSV)       (CSV)   Microsoft WAI│
└──────┬───────────────┬────────────┬───────────┬──────────┬──────┘
       │               │            │           │          │
       ▼               ▼            ▼           ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│ INGESTION  (python/skillbridge/ingest/)                         │
│  • idempotent downloaders  • checksum + row-count validation    │
│  • raw zone: data/raw/<source>/<release>/*.parquet              │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ WAREHOUSE  (DuckDB file: data/skillbridge.duckdb)               │
│  dbt project (dbt-duckdb):                                      │
│   staging  → stg_onet_skills, stg_oews_wages, stg_aioe, ...     │
│   core     → dim_occupation, dim_descriptor, dim_metro,         │
│              dim_soc_crosswalk, fct_occupation_descriptor,      │
│              fct_wages, fct_ai_exposure                         │
│   marts    → mart_occupation_vectors, mart_transitions,         │
│              mart_metro_wages, mart_exposure_triangulated       │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ COMPUTE LAYER  (python/skillbridge/engine/)                     │
│  • vectors.py     occupation vectors (IM×LV weighted)           │
│  • distance.py    pairwise skill distance (cosine + gap terms)  │
│  • frontier.py    Pareto non-dominated set per origin           │
│  • paths.py       multi-hop graph search (escape routes)        │
│  • bom.py         skill-gap bill of materials                   │
│  Precomputes → data/artifacts/*.parquet (served, not recomputed)│
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ API + STATIC HOST  (FastAPI, python/skillbridge/api/)           │
│  GET /occupations?q=            search/autocomplete             │
│  GET /transitions/{soc}         scatter data + frontier flags   │
│  GET /bom/{from}/{to}           skill-gap bill of materials     │
│  GET /paths/{soc}?hops=3        chained escape routes           │
│  GET /metro/{from}/{to}         metro wage-arbitrage data       │
│  GET /exposure/{soc}            triangulated AI exposure        │
│  GET /card/{from}/{to}          escape-plan card (PNG render)   │
│  GET /                          serves the static frontend      │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND  (web/ — custom HTML/CSS/JS, no framework, no build)   │
│  index.html + styles.css + app.js + Plotly.js                   │
│  ① Search  ② Frontier scatter  ③ BOM drawer                     │
│  ④ Escape-route stepper  ⑤ Metro choropleth  ⑥ Share card       │
│  Design contract: docs/05_DESIGN.md (dark canvas, one accent)   │
│  All data via fetch() → the API above; zero in-browser math     │
└─────────────────────────────────────────────────────────────────┘

Orchestration: flows/pipeline.py — plain fail-fast runner (ingest → normalize → dbt build+test → precompute → quality report)
Packaging:     Docker (ONE image: FastAPI serves API + web/) ; Makefile targets
CI:            GitHub Actions (lint, pytest, dbt test on sample data)
Deploy:        GitHub Pages (free, static edition: skillbridge.export_static, built by Actions)
               Docker remains for local/any-host runs of the full FastAPI product
```

## 2. Why these choices

| Choice | Reason |
|---|---|
| **DuckDB** (not Postgres) | All sources fit in-process; zero-ops; the `.duckdb` file ships inside the Docker image → the deployed demo needs no database server. Postgres swap is trivial later (dbt adapter change). |
| **dbt** | The star schema + crosswalk logic is the real data-engineering showcase; dbt tests make the riskiest layer (joins) verifiable and visible to reviewers. |
| **Precomputed artifacts** | ~900×900 transition matrix is tiny (<1M pairs). Precompute once in the pipeline; the API only reads parquet → sub-50ms responses, no model server needed. |
| **Custom HTML/CSS/JS frontend (no Streamlit, no framework)** | The UI is a designed product surface, not a notebook wrapper: full control of look and motion per `05_DESIGN.md`, and it demonstrates frontend skill. No React/build step in v1 — five views don't justify one, and a static folder keeps deploys trivial. Plotly.js in the browser gives the same interactive scatter/choropleth Streamlit would have, restyled. |
| **FastAPI is the single backend** | The API *is* the product; the browser is one client and talks only to it (`fetch()`), which makes contract tests meaningful and makes the v2 React swap a pure frontend change. FastAPI also serves the static `web/` folder → one process, one Docker image, one deploy. |
| **Plain pipeline runner** (`flows/pipeline.py`) | Five ordered fail-fast steps need no scheduler; a plain subprocess runner keeps `make build` dependency-light and readable. Prefect/Airflow are documented upgrades if scheduling ever matters. |

## 3. Data model (core tables)

```text
dim_occupation        (soc_code PK, onet_soc_code, title, description)
dim_descriptor        (descriptor_id PK, name, domain: skill|knowledge|ability|activity)
dim_metro             (area_code PK, area_name, state, lat, lon)
dim_soc_crosswalk     (onet_soc_code, soc_code, oews_code)   -- tested join spine

fct_occupation_descriptor (soc_code, descriptor_id, importance, level)  -- suppressed rows filtered
fct_wages             (oews_code, area_code, emp, wage_median, wage_p10..p90)  -- NULLs for suppressed
fct_ai_exposure       (soc_code, source: aioe|openai|msft, score_raw, score_pct_rank)

mart_occupation_vectors    (soc_code, vector FLOAT[])           -- IM-normalized × LV
mart_exposure_triangulated (soc_code, exposure_composite, agreement_flag, per-source pct ranks)
mart_transitions           (from_soc, to_soc, skill_gap, wage_delta, exposure_delta,
                            pareto_flag BOOL, feasible_flag BOOL)
mart_metro_wages           (from_soc, to_soc, area_code, wage_delta_metro)
```

## 4. Core algorithms

### 4.1 Occupation vectors & skill gap
- Vector: for each descriptor, `value = (IM/5) × LV`; z-normalize per descriptor across occupations.
- **Skill gap (asymmetric — this matters):** cosine distance alone is symmetric, but moving Teller→Surgeon ≠ Surgeon→Teller. Four terms (weights in `config.yaml`):
  `gap = α·cosine_distance + β·Σ max(0, target_LV − origin_LV) × target_IM_norm + γ·max(0, JZ_t − JZ_o)/4 + δ·(1 − task_similarity)`
  Only *deficits* count in β and γ. The γ term is O*NET Job Zone (education/preparation) distance — without it, occupations with similar cognitive profiles but very different credentials look deceptively close. The δ term is TF-IDF cosine similarity over each occupation's 19k O*NET task statements — the domain-affinity signal ("processes financial transactions" vs "operates locomotives") that the 11 basic skills cannot carry. Defaults α=0.15, β=0.25, γ=0.30, δ=0.30.
- Feasibility additionally requires: target Job Zone ≤ origin + 1 (one education level per move) and target national employment ≥ 20k (no wage-outlier niche occupations).
- The Related-Occupations validation is deferred with the full O*NET 31.0 download (that table is not in the local-edition sources); the engine's synthetic-fixture tests cover frontier/gap/path correctness instead.

### 4.2 AI-exposure triangulation
- Convert each source to a percentile rank (they use incompatible scales).
- `exposure_composite = mean(pct_ranks present)`; `agreement_flag = (max−min pct_rank) ≤ 0.25`.
- UI always shows all three bars, never just the composite — honesty is the feature.

### 4.3 Pareto frontier
- For origin o, each candidate t is a point `(skill_gap↓, wage_delta↑, exposure_delta↓)`.
- Standard non-dominated sort (O(n²) on <900 points — instant). `pareto_flag = true` for the frontier set.
- Filter: `feasible_flag = skill_gap ≤ τ` (default τ = 65th percentile of all gaps from o) to keep the scatter honest.

### 4.4 Escape-route chaining
- Directed graph: edge o→t if `feasible_flag` and `wage_delta > −5%`.
- Beam search (beam 20, max 3 hops) maximizing `cumulative_wage_delta − λ·cumulative_skill_gap − μ·final_exposure`; return top 5 distinct paths.
- Precompute for all origins → parquet; API is a lookup.

## 5. Frontend spec (v3 — single-file app on the /data contract)

The UI is the adopted stakeholder design (docs/05_DESIGN.md §11), one
self-contained `web/index.html` (React runtime + Geist fonts embedded; sources
in `web/src/`, rebuilt by `tools/rebundle.py`; no npm, no build step).

**Data contract:** the app consumes only `./data/*.json` —
`occupations.json`, `config.json`, `skills.json`, `origins/{soc}.json` —
built by `skillbridge/api/webdata.py`. The same builders serve two hosts:

- GitHub Pages: `skillbridge.export_static` writes them as files (plus the app)
- FastAPI: serves them live under `/data/` in `make app` AND `make demo`
  (sample fixture), so the identical UI runs everywhere

**Rule-4 deviation (documented):** the browser performs presentation-level
selection and assembly only — the priority sliders re-rank precomputed
frontier moves, BOM tiers derive from precomputed O*NET levels, and target
details are joined from occupations.json. Wages, gaps, exposure percentiles,
frontier flags and routes are never computed client-side. The classic REST
endpoints (`/api/*`, incl. the share-card PNG) remain for API consumers and
are contract-tested.

Feature-by-feature wiring and honest substitutions: docs/07_UI_GAP_ANALYSIS.md.

## 6. Testing strategy (what reviewers will check)

| Layer | Tests |
|---|---|
| Ingestion | checksum/row-count per source; schema snapshot tests |
| dbt | not-null/unique keys; **crosswalk coverage ≥95%**; suppressed-value handling; accepted-values on scales |
| Engine | frontier correctness on synthetic fixtures; asymmetry property (`gap(a,b) ≠ gap(b,a)`); Related-Occupations sanity assertion; path-search determinism |
| API | endpoint **contract tests** (FastAPI TestClient) — now load-bearing: the browser depends entirely on these response shapes; plus a smoke test that `GET /` serves the frontend |
| CI | GitHub Actions: ruff + pytest + dbt build/test on a bundled 20-occupation sample so CI needs no downloads |

## 7. Repo layout

```text
skillbridge/
├── README.md                  # pinned demo video, architecture diagram, quickstart
├── docs/                      # 00_PROJECT_PROFILE.md, 01_PLAN.md, 02_ROADMAP.md,
│                              # 03_ARCHITECTURE.md, 04_DATASETS.md, 05_DESIGN.md
├── data/                      # raw/ (gitignored), sample/ (committed 20-occ sample), artifacts/
├── dbt/                       # dbt-duckdb project (staging/core/marts + tests)
├── python/skillbridge/
│   ├── ingest/  engine/  api/  cards/
├── web/                       # index.html, styles.css, app.js (static; served by FastAPI)
├── flows/pipeline.py          # Prefect flow: ingest → dbt → precompute
├── tests/
├── Dockerfile  docker-compose.yml  Makefile  .github/workflows/ci.yml
```

## 8. Make targets (the contract for humans and Claude)

```make
make setup      # venv + deps
make ingest     # download all sources → data/raw (idempotent)
make build      # dbt build + precompute artifacts
make test       # ruff + pytest + dbt test
make app       # uvicorn: FastAPI serving the API + the web/ frontend
make demo       # everything on the bundled sample data (no downloads)
make docker     # build + run the full image
```

(`make api` is gone — the API and the app are the same process now.)
