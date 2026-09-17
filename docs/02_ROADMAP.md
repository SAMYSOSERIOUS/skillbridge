# SkillBridge — Roadmap

Timeline assumes one developer, part-time (~10–15 h/week). Total: **~7 weeks to a deployed product** — the research estimate of 5–6 dev-weeks plus ~4 days for the hand-built frontend (the custom HTML/CSS/JS UI replaces Streamlit; see `05_DESIGN.md`).

```text
Week 1        Week 2        Week 3        Week 4        Week 5        Week 6        Week 7
──────────────────────────────────────────────────────────────────────────────────────────
[M0 Skeleton][M1 Data foundation      ][M2 Engine        ][M3 Product: API → HTML UI   ][M4 Ship ]
 repo+CI      ingest → dbt → tests      gap/frontier/paths  endpoints, then the 5 views   deploy+video
                                                                    ▲
                                                            first shareable GIF
```

## Phase 0 — Skeleton (days 1–3)
- Init repo from `docs/` (this document set), Makefile, Dockerfile, CI workflow
- Hand-built 5-occupation fixture dataset; dummy end-to-end path (`make demo`)
- Static frontend stub (`web/index.html`) served by FastAPI, with the design tokens from `05_DESIGN.md` wired in from day one
- ✅ Exit: CI green; dummy scatter renders in the HTML page

## Phase 1 — Data foundation (days 4–12)
- Day 4–5: ingestion for O*NET (SQL/CSV) + raw-zone validation
- Day 6–7: OEWS national + metro files; suppression/top-code handling
- Day 8: AIOE + GPTs-are-GPTs + Microsoft WAI CSVs
- Day 9–11: **crosswalk spine** (`dim_soc_crosswalk`) + dbt core models + tests; coverage report
- Day 12: marts (`mart_occupation_vectors`, `mart_exposure_triangulated`)
- ✅ Exit: dbt build + test green on full data; coverage ≥95%; data_quality.md generated

## Phase 2 — Engine (days 13–19)
- Day 13–14: vectors + asymmetric skill gap; Related-Occupations sanity assertion
- Day 15: exposure triangulation (pct ranks, agreement flag)
- Day 16: Pareto frontier + feasibility threshold; `mart_transitions`
- Day 17–18: beam-search escape routes; precompute all origins → artifacts
- Day 19: skill-gap BOM
- ✅ Exit: engine test suite green; full precompute < 5 min; artifacts written

## Phase 3 — Product (days 20–31) — API first, then the UI against it
- Day 20–21: **FastAPI endpoints + contract tests** (the browser's only data source — locked before any UI work)
- Day 22–23: search view + frontier scatter in Plotly.js (animated entry — record the first GIF here)
- Day 24–25: BOM drawer + escape-route stepper
- Day 26–27: metro choropleth + slider
- Day 28: share card export (server-side PNG endpoint)
- Day 29–31: design polish pass against `05_DESIGN.md` (copy, empty states, loading, responsive check, dark-canvas consistency)
- ✅ Exit: 15-second demo path is flawless on 5 tried origins (Bank Teller, Cashier, Paralegal, Truck Driver, Data Entry Keyer); UI matches the design brief

## Phase 4 — Ship (days 32–36)
- Day 32: Docker final image (one container: FastAPI serving API + static `web/`); `make demo` re-verified from clean clone
- Day 33: deploy to Hugging Face Spaces (Docker mode) or Render/Fly.io
- Day 34: README (pinned 30-sec video, GIF, architecture diagram, quickstart, limitations, attribution)
- Day 35: record demo video; LinkedIn post draft ("Bank Teller → where next? I built the answer.")
- Day 36: buffer / issues from a friend's cold test
- ✅ Exit: live URL + recruiter-grade repo

## Post-v1 (only after shipping)
- **v1.1:** free-text/résumé input via local sentence-transformers; Microsoft WAI if deferred
- **v1.2:** cost-of-living adjustment (BLS/BEA RPP data); "team skills gap" mode
- **v2:** React + deck.gl frontend on the same FastAPI backend (the API contract is already the product boundary); EU labor data (ESCO) as an international angle

## Weekly checkpoint ritual
Every Sunday: (1) is CI green? (2) does `make demo` still pass from clean clone? (3) record a 20-second screen capture of current state — these become the "build in public" LinkedIn thread.
