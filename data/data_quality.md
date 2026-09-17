# Data quality report

Generated 2026-09-17T17:26:59+00:00 by `python -m skillbridge.quality`. Nothing in the pipeline is dropped silently; every filter is counted here.

## Sources ingested (pinned commits, checksummed)

| source | rows | file |
|---|---|---|
| openai | 923 | `occ_level.csv` |
| onet_skills | 873 | `occupations_onet_basic_skills.csv` |
| onet_match | 972 | `occupations_onet_bls_matched.csv` |
| oews | 1403 | `national_May2021_dl.csv` |
| aioe | 774 | `aioe.xlsx` |
| msft | 785 | `ai_applicability_scores.csv` |
| onet_tasks | 19265 | `full_onet_data.tsv` |

## Warehouse

- Occupations in spine (`dim_occupation`): **944**
- Servable occupations (wage + >=2 exposure sources + skills): **714**
- Wage rows: **831**, of which **18** top-coded (median >= $208,000/yr in the May 2021 release; stored as NULL + flag, never a guess) and **6** suppressed (stored as NULL, never 0).
- Exposure rows: **2357** across 3 sources; **669** occupations have all three, **259** have disagreeing sources (shown honestly in the UI).

## Crosswalk (`dim_soc_crosswalk`)

- Names mapped: **873** (explicit: 832, title-fallback: 41)
- Ambiguous names (several SOC candidates, resolved deterministically): **0**
- Skills-file names left unmatched: **0**

## Occupations excluded from analysis (still searchable, with the reason shown)

- no O*NET skill profile (residual category): **93**
- no published median wage (suppressed or top-coded): **137**

## Known limitations

- Wages: national medians, May 2021 OEWS release; no cost-of-living adjustment.
- Skill space: the 11 O*NET basic skills + Job Zones + task-text similarity; the full 200+ O*NET descriptor space is a documented extension (docs/04_DATASETS.md).
- Exposure indices measure exposure, not certain displacement.
