# SkillBridge — Dataset Reference

Every dataset below is real, publicly accessible, and was verified during research (Sept 2026). This file is the single source of truth for data acquisition. **Never invent data values; if a download fails, stop and report.**

---

## D1. O*NET 31.0 Database (core skills ontology)

- **Publisher:** US Department of Labor / Employment and Training Administration (O*NET Resource Center)
- **URL:** https://www.onetcenter.org/database.html (download page; SQL text files, CSV, Excel)
- **Contents:** ~900 occupations (923 data-level) coded with 8-digit O*NET-SOC 2019 codes; 200+ descriptors across Skills, Abilities, Knowledge, Work Activities, Work Context, plus 19k+ task statements. Key tables: `Skills`, `Knowledge`, `Abilities`, `Work Activities` — each row = (occupation, descriptor, scale, value) where scale is **IM** (importance, 1–5) or **LV** (level, 0–7).
- **Scale:** tens of MB unzipped; loads into DuckDB in seconds.
- **License:** CC BY 4.0 — **attribution required**; include the O*NET attribution line in README and app footer.
- **Role in SkillBridge:** builds the occupation vector space. Occupation vector = concat of descriptor values weighted by importance. Also provides `Occupation Data` (titles, descriptions) and `Related Occupations` (sanity-check baseline for similarity).
- **Gotchas:** descriptor values come with standard errors and `Recommend Suppress` flags — filter suppressed rows. Use IM and LV as separate channels (don't average them blindly); default weighting: `IM-normalized × LV`.

## D2. BLS Occupational Employment and Wage Statistics (OEWS), May 2025 release

- **Publisher:** US Bureau of Labor Statistics
- **URL:** https://www.bls.gov/oes/tables.htm (XLSX bulk downloads: national, state, metro "MSA" files); API: BLS Public Data API v2 (optional).
- **Contents:** employment counts and wage statistics (mean, median, 10/25/75/90th percentiles) for ~830 SOC-coded occupations at national, state, and ~530 metropolitan/nonmetropolitan area levels.
- **Scale:** national file ~1k rows; the all-areas file ~400k+ rows. Fine for DuckDB.
- **License:** US Government public data.
- **Role:** wage deltas (national default) and the Metro Wage-Arbitrage map (metro-level).
- **Gotchas:** wages of top earners are top-coded (annual wage shown as `#` = ≥ $239,200 in recent releases — check the release notes); some occupation×metro cells are suppressed (`*` / `**`). Treat suppressed cells as NULL, never zero. OEWS uses SOC 2018-based codes — crosswalk required (see D6).

## D3. AIOE — AI Occupational Exposure index

- **Publisher/authors:** Felten, Raj & Seamans (2021), *Strategic Management Journal* 42(12): 2195–2217
- **URL:** https://github.com/AIOE-Data/AIOE (CSV in repo)
- **Contents:** occupation-level AI exposure scores built from 52 O*NET abilities linked to 10 AI application areas; z-scores roughly in [−2.67, +1.58]; keyed by SOC code. Also contains AIIE (industry) and AIGE (geography) variants — SkillBridge uses AIOE only.
- **License:** open access; cite the paper (attribution).
- **Role:** exposure channel 1 (ability-based).

## D4. "GPTs are GPTs" occupational exposure (OpenAI / Eloundou et al.)

- **Publisher:** Eloundou, Manning, Mishkin, Rock — *Science* 384:1306–1308 (2024)
- **URL:** https://github.com/openai/GPTs-are-GPTs (data + code)
- **Contents:** task-level and occupation-level LLM-exposure ratings (human + model annotated) keyed to O*NET-SOC; exposure measures (e.g., alpha/beta/zeta aggregations of task exposure).
- **License:** **MIT** (permissive).
- **Role:** exposure channel 2 (task-based, LLM-specific).

## D5. Microsoft Research "Working with AI" (AI applicability score)

- **Publisher:** Tomlinson et al., Microsoft Research, arXiv:2507.07935 (2025)
- **URL:** https://github.com/microsoft/working-with-ai
- **Contents:** an "AI applicability score" for 785 occupations derived from 200k anonymized US Bing Copilot conversations (Jan–Sep 2024) — i.e., *observed real-world AI usage*, not theoretical exposure. Highest-scoring occupation: Interpreters and Translators (0.49/1.0).
- **License:** **CC BY 4.0** (attribution).
- **Role:** exposure channel 3 (revealed usage). Completes the triangulation: theory (D3) + capability mapping (D4) + observed behavior (D5).

## D6. Crosswalks (the make-or-break join layer)

- **O*NET-SOC 2019 ↔ SOC 2018:** O*NET Resource Center crosswalk files (https://www.onetcenter.org/crosswalks.html). 8-digit O*NET-SOC codes map to 6-digit SOC; detailed O*NET occupations (e.g., `-01`+ suffixes) roll up to their parent SOC.
- **OEWS occupation codes:** OEWS uses a hybrid SOC 2018 taxonomy — a small number of OEWS codes aggregate multiple SOC codes. Handle via the OEWS documentation's code list.
- **Rule:** every join goes through an explicit `dim_soc_crosswalk` table built in dbt, with tests asserting: (a) every O*NET occupation resolves to ≥1 OEWS wage row at national level, (b) join coverage ≥95%, (c) unmatched codes are logged to a report, never silently dropped.

## D7. (Optional, v1.1) Embedding model for free-text job input

- `sentence-transformers` model (e.g., `all-MiniLM-L6-v2`, Apache-2.0) run locally to embed user free-text ("I process loan applications at a bank branch") and match to the nearest O*NET occupation title+description embedding. No external API required; keeps the app free to run.

---

## Attribution block (must appear in README + app footer)

> This product uses the O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. Wage data: U.S. Bureau of Labor Statistics, OEWS. AI-exposure indices: Felten, Raj & Seamans (AIOE); Eloundou et al. (OpenAI, MIT license); Tomlinson et al. (Microsoft Research, CC BY 4.0). SkillBridge is not endorsed by any of these organizations.
