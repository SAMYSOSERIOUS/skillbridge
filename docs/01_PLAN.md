# SkillBridge — Build Plan

Goal: a **deployed, fully functioning product** with the Pareto Reskilling Frontier as its signature wow factor, built by one developer, recruiter-inspectable at every layer.

## 1. Scope

### In scope (v1 — the shipped product)
- All five datasets ingested, validated, modeled in dbt/DuckDB
- Transition engine: skill gap, wage delta, triangulated AI exposure, Pareto frontier, escape-route chaining, skill-gap BOM
- **Custom HTML/CSS/JS frontend** (five views: search, frontier, BOM, routes, metro map + share card), designed to the design brief in `05_DESIGN.md`, rendered with Plotly.js, served as static files by FastAPI
- FastAPI service exposing the engine — the browser talks *only* to the API (clean product boundary; contract tests matter)
- Docker one-command run; `make demo` sample mode with zero downloads
- CI (lint + tests + dbt tests), pinned 30-second demo video, architecture diagram in README

### Out of scope for v1 (documented as extensions)
- Résumé/free-text input via embeddings (v1.1)
- Cost-of-living adjustment; non-US labor data
- User accounts, saved plans
- React/deck.gl frontend (v2 — only if v1 gets traction; v1 stays framework-free by design)

## 2. Milestones & definition of done

### M0 — Skeleton (repo compiles end to end)
- Repo layout, Makefile, Docker, CI green on an empty pipeline
- **DoD:** `make demo` runs on a hand-built 5-occupation fixture and renders a dummy scatter in the static HTML page served by FastAPI.

### M1 — Data foundation (the engineering proof)
- Ingestion for all 5 sources + crosswalk; dbt staging→core→marts; all dbt tests green
- **DoD:** crosswalk coverage report ≥95%; `mart_occupation_vectors` and `fct_ai_exposure` populated; suppressed OEWS cells are NULL; a `data_quality.md` report is auto-generated.

### M2 — Engine (the brains)
- vectors, asymmetric gap, triangulated exposure, Pareto frontier, beam-search paths, BOM
- **DoD:** Related-Occupations sanity test passes; frontier verified on synthetic fixtures; full precompute for all origins finishes < 5 min locally and writes artifacts.

### M3 — Product (the wow)
- FastAPI endpoints first (they are the frontend's only data source), then the five HTML views built against the live API: animated frontier scatter + BOM drawer + escape-route stepper + metro map + share card
- **DoD:** the 15-second demo path works flawlessly: type "Bank Teller" → frontier animates → click target → BOM + "+$X/yr, AI exposure ↓". Share card exports a clean PNG. API contract tests green (the browser depends entirely on the API's response shapes). UI matches `05_DESIGN.md`.

### M4 — Ship (the recruiter experience)
- Deploy (Hugging Face Spaces in Docker mode, or Render/Fly.io — one FastAPI container serving API + static frontend), README with pinned video + GIF + architecture diagram, Limitations & Responsible-Use section, attribution block
- **DoD:** a stranger can (a) open the live link and get value in 30 seconds, (b) `git clone && make demo` successfully, (c) find every claim in the README backed by a test or doc.

## 3. Risk register & scope cuts

| Risk | Likelihood | Mitigation / cut |
|---|---|---|
| Crosswalk mess (O*NET-SOC ↔ OEWS hybrid codes) | High | Budgeted first in M1; explicit crosswalk table + tests; unmatched codes logged not dropped. This is the hardest part — do it before anything shiny. |
| Hand-built frontend takes longer than a Streamlit page | Medium–High | Roadmap already budgets ~4 extra days for it; API-first order means the UI is pure presentation; `05_DESIGN.md` fixes the design up front so no mid-build redesigns; scope is 5 views, no framework, no build step. |
| Frontier scatter unreadable in 15s | Medium | Fallback ranked "Top escape routes" list view is built anyway (it's just the frontier sorted); A/B the GIF. |
| Microsoft WAI join friction | Medium | Ship with AIOE + OpenAI only (both direct SOC joins); add MS WAI in v1.1. Triangulation degrades gracefully to 2 sources. |
| Metro map scope creep | Medium | Cut to national wages only for v1 if behind; the map is Mechanic 4, not the signature. |
| Deploy limits (free-tier memory on HF Spaces / Render) | Low | Artifacts are parquet lookups (<100MB); DuckDB file ships in image; static frontend adds ~0 weight; no model server. |

**Never cut:** the Pareto frontier, the BOM, escape-route chaining, `make demo`, dbt tests. These are the identity of the project.

## 4. Quality bars (applies to every milestone)
- No silent data drops — every filtered/unmatched row is counted in the data-quality report.
- Every number shown in the UI is traceable to a mart column via an API response (no in-frontend math beyond formatting).
- All parameters (α, β, τ, λ, μ, beam width) live in one `config.yaml` with documented defaults.
- Honest UI: exposure always shows all three sources; disagreement is displayed, not hidden.
- The frontend follows `05_DESIGN.md` — one accent color, dark canvas, no framework, no CDN-free-for-all (Plotly.js is the only runtime dependency).

## 5. Working agreement for building with Claude
- Build milestone by milestone; each ends with `make test` green before starting the next.
- Prefer boring, verifiable code over clever code; the star of this repo is the data model and the mechanics.
- When a dataset's real schema differs from `04_DATASETS.md`, update the doc in the same commit — docs and code never drift.
- When the UI deviates from `05_DESIGN.md` for a good reason, update the design doc in the same commit.
