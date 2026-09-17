# UI prototype vs. backend — gap analysis

**Source:** `SkillBridge_App.html` (stakeholder prototype, React + sc-template
bundle, Geist font, clay-orange accent, 3D scenes).
**Method:** the prototype was unpacked and every visible feature was compared
against what the pipeline/artifacts can actually serve. Verdicts: **WIRED**
(connected to real data as-is), **SUBSTITUTED** (feature kept, fed with an
honest real equivalent because the prototype's field was invented),
**DEFERRED** (needs data we don't have yet; shown honestly or hidden).

The prototype ships **hand-typed demo data for exactly 2 occupations**
(Tellers, Surgeons) with invented values. The backend serves **714 real
occupations**. Rule 1 (never invent data) governs every decision below.

| # | Prototype feature | Prototype data | Backend has | Verdict |
|---|---|---|---|---|
| 1 | 3D hero globe, orbit/drag/hover, guided 3-step tour | presentation only | n/a | **WIRED** (kept verbatim) |
| 2 | 3D map / flat chart / list views + remembered view (localStorage) | presentation | n/a | **WIRED** |
| 3 | Priority sliders (pay/speed/AI safety) re-rank the recommendation; "the map doesn't change" | client formula | frontier precomputed; selection is client-side | **WIRED** (documented client-side *selection* over precomputed moves; formula shown in "Why this move?") |
| 4 | Verdict line + "Why this move?" reasoning panel | derived | derivable from real fields | **WIRED** |
| 5 | Frontier pillars/dots per origin | 5 fake moves + 11 decor dots | ~300 real feasible moves, ~30-50 frontier | **WIRED** (top-10 ranked pillars labeled in 3D; all moves in flat/list) |
| 6 | AI-exposure ranges (e.g. "52–86th"), per-source bars, agreement flag, 34-point-spread note | invented ranges | real: 3 source percentiles per occupation | **WIRED** (range = min–max of real sources) |
| 7 | Metro wage selector (NY ×1.22, DFW ×1.04, PHX ×0.97) | **invented multipliers** | national wages only (metro OEWS needs bls.gov download — deferred v1.1) | **DEFERRED** (selector shows "United States (national)"; metro view returns with the real OEWS metro file) |
| 8 | Retraining time ("6–9 mo", plan dates from months) | **invented** | O*NET Job Zones (real) | **SUBSTITUTED**: preparation band from the target's official Job Zone definition (e.g. zone 3 = "1–2 years typical prep"); plan dates are user-editable suggestions labeled as such |
| 9 | "License needed: NMLS / Series 65" | **invented** | no licensing dataset in v1 sources | **DEFERRED**: field reads "Not tracked in v1 — check your state's requirements"; global licensing caveat kept |
| 10 | Openings/yr ("~31,200 openings/yr") | **invented** | real national employment per occupation (OEWS) | **SUBSTITUTED**: "≈X employed in the US (May 2021)" |
| 11 | "Common path / Untapped" popularity (BLS CPS mobility flows, marked "illustrative") | **invented** | no mobility-flow dataset | **SUBSTITUTED**: field-size tag from real employment (Big / Mid-size / Smaller field); all mobility-flow wording removed |
| 12 | Skill checklist drawer: must-learn (with level jumps + course line + weight bar), upgrade, already-have, copy-for-resume | fake skills | real BOM from O*NET levels | **WIRED** (course line becomes a neutral "search courses for '<skill>'" pointer — no invented courses) |
| 13 | "Your plan, with dates" (check-off milestones, saved) | months invented | real tiers; dates are user's own | **WIRED** with zone-based *suggested* dates, editable, stored locally |
| 14 | Compare tray (up to 3), save/star, email card | client state | real fields | **WIRED** (email card = mailto summary) |
| 15 | "Try: Surgeon (no better move)" empty-state | hardcoded surgeon | real: occupations whose frontier has no positive-pay move exist in the data | **WIRED** (example computed from real artifacts at build time) |
| 16 | "What people in your position do instead" rows | hardcoded 2 rows | derivable: lower-exposure ≈same-pay and least-retraining moves from real transitions | **WIRED** (computed per origin) |
| 17 | "Alert me if the sources shift" | no backend | no accounts/jobs in a free static app | **DEFERRED**: row reads "data refreshes with each release — watch the GitHub repo" |
| 18 | "Data updated May 2026" | **invented** | real build timestamp in meta.json | **WIRED** (real build date) |
| 19 | Search box ("Find my moves") | regex on 2 names | 714 searchable occupations | **WIRED** (+ native suggestion list and a friendly not-found message — the prototype had neither) |
| 20 | Geist font, clay-orange accent, dark canvas | embedded woff2 | n/a | **WIRED** (fonts ship inside the file; 05_DESIGN.md updated: accent becomes #ff7a59) |

## Approach taken

The prototype file is kept **as-is structurally** — same layout markup, same
styles, same 3D scenes, same logic flow. Exactly two kinds of change were made:

1. **The data layer**: the hand-typed `DATA`/`METROS` constants are replaced by
   loaders for the same JSON the pipeline already exports (occupations,
   per-origin bundles, skill matrix, config/meta). One app now runs identically
   on GitHub Pages and under FastAPI.
2. **Honesty patches** listed above (#7–#11, #17, #18), each visible in the UI
   rather than silently faked.

Client-side computation note (extends the rule-4 deviation in
03_ARCHITECTURE.md §5): the priority sliders *select among* precomputed
frontier moves, and BOM tiers derive from precomputed O*NET levels. No wages,
gaps, exposures, frontier flags, or routes are ever computed in the browser.
