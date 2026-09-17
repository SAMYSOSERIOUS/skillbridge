# SkillBridge AI — Project Profile

**The AI-Era Career Navigation Engine**

> "I work as a bank teller. What should I realistically become next?"
> SkillBridge answers with data, not opinions: the best career moves ranked by salary gain, retraining effort, and safety from AI displacement — plus the exact skills to learn to get there.

---

## 1. Elevator pitch

Type your job title. SkillBridge maps every realistic career transition on a **Pareto Reskilling Frontier** — the set of moves that simultaneously **raise your salary**, **minimize retraining effort**, and **lower your AI-displacement risk** — then hands you a precise **Skill-Gap Bill of Materials** for the move you pick, and shows you where in the country that move pays best.

## 2. Problem being solved

- Workers facing AI disruption don't know which careers are realistic *for them* — most advice is generic ("learn to code") or based on vibes.
- Career coaches and workforce agencies have no tool that combines skill transferability, wage data, and AI exposure in one place.
- Existing career recommenders answer "what jobs are similar to mine?" — the wrong question. The right question is "which move is *worth it*?"

## 3. Target users

| User | What they get |
|---|---|
| Job seeker / worker at risk | A ranked list of realistic "escape routes" with wage upside and a learning checklist |
| Career coach / workforce agency | A defensible, data-backed transition recommendation tool |
| L&D / internal mobility team | Skill-gap analysis between any two roles in a company's job architecture |
| Policy analyst / journalist | Which occupations have viable transitions away from high AI exposure, and which are trapped |

## 4. Why this is unique (verified against existing work)

The saturated pattern on GitHub: O*NET recommenders that map a skill profile to "similar occupations" (`yashhcoder/CareerLens`, `chandima2000`, `Zurinlakdawala91`) or predict a job title from a résumé (`eddiepease/career_path_recommendation`) or a quiz (`Yashpurbhe123/CareerPath_Recommender`). All stop at similarity-based recommendation.

**SkillBridge is a multi-objective *decision* engine, not a similarity recommender.** The research round confirmed the O*NET × AI-exposure fusion is one of the least saturated public-data opportunities. No common portfolio project combines:

1. Skill-distance computation from the full O*NET descriptor space
2. Wage deltas from BLS OEWS (national + ~530 metro areas)
3. **Three independent AI-exposure indices** (AIOE, OpenAI/Eloundou, Microsoft) triangulated per occupation
4. Pareto-frontier optimization across all three objectives
5. Multi-hop career-path chaining (2–3 step escape routes)

## 5. Signature mechanics (the WOW factors)

### Mechanic 1 — The Pareto Reskilling Frontier (the signature)
For the user's occupation, compute against every other occupation:
- **Skill gap** (importance-weighted cosine distance + positive descriptor gaps in O*NET space)
- **Wage delta** (OEWS median wage difference)
- **AI-exposure delta** (target's triangulated exposure vs. current)

Plot all transitions as a scatter; highlight the **non-dominated (Pareto-efficient) frontier** in green: the moves where you can't do better on one objective without sacrificing another. Everything below the frontier is a dominated move — visually, instantly obvious.

### Mechanic 2 — Skill-Gap Bill of Materials
Click a target occupation → a decomposed checklist:
- ✅ **Transferable now** — skills where your level already meets the target's importance threshold
- 🟡 **Upgrade needed** — skills you have but at insufficient level (with gap size)
- 🔴 **Must acquire** — skills the target demands that your occupation doesn't develop
Ranked by importance-weighted gap, so the user sees *exactly what to learn first*.

### Mechanic 3 — Career Path Chaining ("Escape Routes")
Single jumps aren't always feasible. A graph search over the transition network finds **2–3 hop paths** where each hop stays under a feasibility threshold:

`Bank Teller → Loan Officer → Compliance Analyst → Financial Examiner`

with cumulative salary, retraining distance, and AI exposure updating at each hop. **This is the LinkedIn demo moment.**

### Mechanic 4 — Metro Wage-Arbitrage Map
For a chosen transition, a choropleth of ~530 metro areas: "same skills, different city, +$18k." A slider scrubs across metros; the wage delta re-renders live.

### Mechanic 5 — Shareable "Career Escape Plan" card
One click exports a polished card (PNG/PDF): current role → recommended path → top 3 skills to learn → projected wage gain → AI-safety change. Built for sharing — which is exactly what makes the product spread on LinkedIn.

## 6. The 15-second demo

1. Type **"Bank Teller"** (0–3s)
2. The transition scatter animates in; the green Pareto frontier lights up three escape routes (3–8s)
3. Click **"Loan Officer"** → the Skill-Gap Bill of Materials slides in with three concrete skills to learn and **"+$21,400/yr, AI exposure ↓"** (8–15s)

Viewer reaction: *"Where can I try this?"*

## 7. Datasets (all real, all verified — full detail in 04_DATASETS.md)

| Dataset | Source | Role | License |
|---|---|---|---|
| O*NET 31.0 Database | US Dept. of Labor / ETA | Skills/knowledge/abilities per occupation (the vector space) | CC BY 4.0 |
| BLS OEWS (May 2025) | Bureau of Labor Statistics | Wages: national, state, ~530 metros, ~830 occupations | Public (US Gov) |
| AIOE index | Felten, Raj & Seamans (GitHub: AIOE-Data/AIOE) | Ability-based AI exposure z-scores | Open access, attribution |
| GPTs-are-GPTs exposure | OpenAI / Eloundou et al. (GitHub: openai/GPTs-are-GPTs) | Task-based LLM exposure per O*NET-SOC | MIT |
| Working with AI | Microsoft Research (GitHub: microsoft/working-with-ai) | AI applicability score, 785 occupations, from real Copilot usage | CC BY 4.0 |

**Why the triangulation matters:** each index measures AI exposure differently (abilities / tasks / observed real usage). Where all three agree, the signal is strong; where they disagree, SkillBridge shows the disagreement honestly — itself a distinctive, credibility-building feature.

## 8. Skills this project demonstrates

Data Engineering (multi-source ETL, SOC crosswalks, dbt star schema) · SQL/DuckDB · Analytics (multi-objective optimization, graph search) · NLP/embeddings (free-text job → O*NET mapping) · Frontend engineering (custom HTML/CSS/JS + Plotly.js, designed to `05_DESIGN.md`) · Visualization (interactive scatter, network, choropleth) · API design (FastAPI as the single backend for the frontend) · Docker · Testing/CI · Product thinking.

## 9. Honest limitations (goes in the repo's Limitations section)

- O*NET descriptor ratings are survey-based averages per occupation, not individual-level data — transitions are estimates of typical feasibility, not guarantees.
- AI-exposure indices measure *exposure*, not certain displacement; the three indices legitimately disagree for some occupations.
- OEWS wages are point-in-time medians; no cost-of-living adjustment in v1 (documented as an extension).
- Crosswalk between O*NET-SOC 2019 (8-digit) and OEWS SOC codes loses some granularity; join coverage is tested and reported.

## 10. Deliverable definition

A deployed public web app (no login, no setup) — a custom-designed HTML/JS frontend served by FastAPI — + a recruiter-grade GitHub repo: README with pinned 30-second demo video, architecture diagram, one-command Docker setup, dbt-modeled warehouse, tested pipeline, CI, and this document set.
