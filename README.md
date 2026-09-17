# SkillBridge AI

**Find realistic career moves with higher pay, smaller skill gaps, and lower AI exposure.**

> 🚧 **Status: Phase 0 (skeleton).** The repo compiles end to end on a 5-occupation synthetic fixture. Real data (O*NET, BLS OEWS, three AI-exposure indices) lands in Phase 1 — see [docs/02_ROADMAP.md](docs/02_ROADMAP.md).

<!-- M4: pinned 30-second demo video goes here -->
<!-- M4: live demo link goes here -->

## What it will do

Type your job title. SkillBridge maps every realistic career transition on a **Pareto Reskilling Frontier** — the moves that simultaneously raise your salary, minimize retraining effort, and lower your AI-displacement risk — then hands you a precise **Skill-Gap Bill of Materials** for the move you pick.

```text
O*NET + OEWS + 3 AI-exposure indices
            ↓
       Ingestion
            ↓
      DuckDB / dbt
            ↓
 Career Scoring Engine  (skill gap · Pareto frontier · escape routes)
            ↓
        FastAPI
            ↓
 Custom HTML/JS frontend
```

Full architecture: [docs/03_ARCHITECTURE.md](docs/03_ARCHITECTURE.md) · Design brief: [docs/05_DESIGN.md](docs/05_DESIGN.md)

## Quickstart (demo mode — zero downloads)

```bash
git clone <this repo>
cd skillbridge
make setup
make demo        # http://localhost:8000 — runs on a bundled synthetic 5-occupation fixture
make test        # ruff + pytest
```

Or with Docker:

```bash
make docker
```

## Repo map

| Path | What |
|---|---|
| `docs/` | The full document set: profile, plan, roadmap, architecture, datasets, design brief |
| `python/skillbridge/` | `ingest/` · `engine/` · `api/` · `cards/` |
| `web/` | Hand-built HTML/CSS/JS frontend (no framework), served by FastAPI |
| `data/sample/` | Committed synthetic fixture (clearly labeled; never real statistics) |
| `dbt/` | dbt-duckdb project (Phase 1) |
| `CLAUDE.md` | Working rules for building this repo with Claude Code |

## Data & attribution

All v1 data sources are real, public, and documented in [docs/04_DATASETS.md](docs/04_DATASETS.md). The fixture in `data/sample/` is **synthetic** and exists only so the app and CI run without downloads.

> This product uses the O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. Wage data: U.S. Bureau of Labor Statistics, OEWS. AI-exposure indices: Felten, Raj & Seamans (AIOE); Eloundou et al. (OpenAI, MIT license); Tomlinson et al. (Microsoft Research, CC BY 4.0). SkillBridge is not endorsed by any of these organizations.

## License

MIT (code). Data licenses per source — see [docs/04_DATASETS.md](docs/04_DATASETS.md).
