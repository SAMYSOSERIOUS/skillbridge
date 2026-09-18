# CLAUDE.md — SkillBridge AI

Context file for Claude when working in this repository. Read `docs/00_PROJECT_PROFILE.md` (what we're building and why it's unique), `docs/01_PLAN.md` (milestones + quality bars), `docs/02_ROADMAP.md` (order of work), `docs/03_ARCHITECTURE.md` (how it's built), `docs/04_DATASETS.md` (data sources — the source of truth for acquisition and joins), and `docs/05_DESIGN.md` (the frontend design contract).

## What this project is
SkillBridge is an AI-era career navigation engine. Signature mechanic: the **Pareto Reskilling Frontier** — for any occupation, the set of career transitions that jointly maximize wage gain and minimize both retraining effort and AI-displacement exposure, computed from real O*NET data + BLS OEWS + three AI-exposure indices (local edition per docs/04_DATASETS.md) (AIOE, OpenAI GPTs-are-GPTs, Microsoft Working-with-AI). Plus: Skill-Gap Bill of Materials, multi-hop Escape Routes, shareable Escape Plan card (Metro Wage-Arbitrage map deferred to v1.1).

The frontend is a **single self-contained file** (`web/index.html`; sources in `web/src/`, rebuilt by `python tools/rebundle.py`) — the adopted stakeholder **v3 wizard design**: embedded React runtime + Geist fonts + modernist token system, a 4-step flow (job → priorities → moves → plan) with the pay-vs-retraining chart, ranked trade-off table, escape routes and the skill-plan step. No npm, no build toolchain, no CDN at runtime. Look and wiring: `docs/05_DESIGN.md` §12 and `docs/07_UI_GAP_ANALYSIS.md`.

**Identity features — never cut or stub these:** Pareto frontier, BOM, escape-route chaining, `make demo`, dbt tests.

## Commands
- `make setup` — create venv, install deps
- `make ingest` — download all sources to `data/raw/` (idempotent; never re-download if checksums match)
- `make build` — full pipeline via flows/pipeline.py: ingest → normalize → dbt build+test → precompute → data-quality report
- `make test` — ruff + pytest + dbt test (must be green before any milestone is called done)
- `make app` — uvicorn: one FastAPI process serving the API **and** the `web/` frontend
- `make demo` — app on the bundled synthetic 5-occupation fixture in `data/sample/` (no network). CI uses this.
- `make site` — export the static GitHub Pages edition to `site/` (after `make build`).

## Hard rules
1. **Never invent data.** All values come from the real files listed in `docs/04_DATASETS.md`. If a download fails or a schema differs from the doc, stop, report, and update the doc in the same commit as the code fix. No synthetic placeholder values outside `data/sample/` fixtures (which are clearly labeled).
2. **No silent drops.** Filtered rows (suppressed O*NET values, suppressed OEWS cells, unmatched crosswalk codes) are counted into the auto-generated `data_quality.md`. Suppressed wages are NULL, never 0.
3. **All joins go through `dim_soc_crosswalk`** — code-based since v2 (8-digit O*NET-SOC truncates to its 6-digit SOC, the official O*NET-SOC 2019 convention), with a dbt test gating wage coverage (`min_crosswalk_coverage`). Never join O*NET-SOC to OEWS codes ad hoc in a model.
4. **The browser talks only to the API.** Every number in the UI comes from a `fetch()` of a FastAPI endpoint backed by marts/artifacts — no in-browser math beyond formatting, no data files loaded directly by the frontend. API contract tests are load-bearing. (Static GitHub Pages edition: the same responses come from exported JSON; only the BOM tier split and share card render client-side from precomputed values — see docs/03_ARCHITECTURE.md §5.)
5. **Tunables live in `config.yaml`** (α, β, τ, λ, μ, beam width) with documented defaults; never hardcode them.
6. **Honest UI:** AI exposure always displays all three source bars and the agreement flag; the composite never appears alone.
7. **Attribution:** the O*NET/BLS/AIOE/OpenAI/Microsoft attribution block from `docs/04_DATASETS.md` must remain in README and the app footer (CC BY 4.0 requirements).
8. **Design contract:** the frontend follows `docs/05_DESIGN.md` — its color tokens are the only colors in `web/`, one accent, both signature animations, all three view states (loading/empty/error), `prefers-reduced-motion` respected. If the UI must deviate, update `05_DESIGN.md` in the same commit.
9. Milestone discipline: follow `docs/02_ROADMAP.md` order (M0→M4). `make test` green before starting the next milestone. In M3, API endpoints + contract tests come **before** any UI work.

## Code conventions
- Python 3.11+, type hints on public functions, ruff for lint/format, pytest for tests.
- Package layout per `docs/03_ARCHITECTURE.md` §7 (`python/skillbridge/{ingest,engine,api,cards}` + static `web/`).
- Frontend: edit `web/src/layout.html` (sc-if/sc-for templates) and `web/src/component.js` (logic), then `python tools/rebundle.py`. Never hand-edit `web/index.html` or `web/src/shell.html`. The app consumes only the `/data/*.json` contract built by `skillbridge/api/webdata.py`.
- DuckDB + dbt-duckdb; marts are the API's only data dependency (served from precomputed parquet in `data/artifacts/`).
- `flows/pipeline.py` (plain fail-fast runner) orchestrates ingest → normalize → dbt build+test → precompute → quality report.
- Keep functions small and testable; the engine (`vectors/distance/frontier/paths/bom`) is pure (no I/O) so it can be tested on fixtures.
- Commit style: `feat|fix|data|docs|test(scope): message`; one milestone-relevant change per commit.

## Definition of done for the whole product (from 01_PLAN.md M4)
A stranger can (a) open the live demo link and get value in 30 seconds, (b) `git clone && make demo` successfully on a clean machine, (c) verify every README claim against a test, doc, or the data-quality report.
