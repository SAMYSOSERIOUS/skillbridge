# SYNTHETIC FIXTURE — NOT REAL DATA

Everything in this folder is a hand-built, clearly-labeled synthetic fixture so that
`make demo`, the tests, and CI can run with zero downloads (CLAUDE.md hard rule 1
allows synthetic values ONLY here).

- 5 fake occupations loosely shaped like the Bank Teller demo path.
- All wages, gaps, and exposure numbers are invented and marked `"synthetic": true`.
- Real data (O*NET 31.0, BLS OEWS, AIOE, OpenAI, Microsoft WAI) replaces the
  serving layer in Phase 1–2; this fixture then remains only for tests and CI.
