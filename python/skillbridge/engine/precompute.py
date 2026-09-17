"""Precompute all serving artifacts from the DuckDB marts.

Reads: data/skillbridge.duckdb (built by dbt)
Writes: data/artifacts/{occupations,transitions,skills}.parquet,
        paths.json, meta.json

Run: python -m skillbridge.engine.precompute
"""

import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

from skillbridge.config import load_config
from skillbridge.engine import core

REPO_ROOT = Path(__file__).resolve().parents[3]
DB_PATH = REPO_ROOT / "data" / "skillbridge.duckdb"
ART_DIR = REPO_ROOT / "data" / "artifacts"


def load_marts() -> tuple[pd.DataFrame, pd.DataFrame]:
    con = duckdb.connect(str(DB_PATH), read_only=True)
    occ = con.execute(
        """
        select soc_code, title, wage_median, wage_topcoded, employment,
               pct_aioe, pct_openai, pct_msft, n_sources,
               exposure_composite, agreement_flag, has_skills, job_zone
        from mart_occupations
        order by soc_code
        """
    ).df()
    skills = con.execute(
        "select soc_code, skill, importance, skill_level from mart_skill_matrix"
    ).df()
    tasks = con.execute("select soc_code, task_text from stg_onet_tasks").df()
    con.close()
    return occ, skills, tasks


def task_distance_matrix(serve_socs: list[str], tasks: pd.DataFrame) -> np.ndarray:
    """1 - TF-IDF cosine similarity of each occupation's O*NET task text.

    This is the domain-affinity signal the 11 basic skills cannot carry:
    'processes customer financial transactions' vs 'operates locomotives'.
    Occupations with no task text get distance 0.5 to everything (neutral,
    counted in the data-quality report).
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    text_by_soc = dict(zip(tasks["soc_code"], tasks["task_text"], strict=False))
    docs = [text_by_soc.get(soc, "") for soc in serve_socs]
    have = np.array([bool(d) for d in docs])

    vec = TfidfVectorizer(stop_words="english", sublinear_tf=True, min_df=2)
    tfidf = vec.fit_transform([d if d else " " for d in docs])
    sim = cosine_similarity(tfidf)
    dist = np.clip(1.0 - sim, 0.0, 1.0)
    dist[~have, :] = 0.5
    dist[:, ~have] = 0.5
    np.fill_diagonal(dist, 0.0)
    return dist


def main() -> int:
    t0 = time.time()
    if not DB_PATH.exists():
        print("No warehouse found - run `make build` (dbt) first.")
        return 1
    cfg = load_config()
    occ, skills_long, tasks = load_marts()

    # Serving set: needs title, wage, >=2 exposure sources, and a skill vector
    serve = occ[
        occ["wage_median"].notna() & (occ["n_sources"] >= 2) & occ["has_skills"]
    ].reset_index(drop=True)
    soc_index = {s: i for i, s in enumerate(serve["soc_code"])}
    n = len(serve)

    skill_names = sorted(skills_long["skill"].unique())
    imp = np.zeros((n, len(skill_names)))
    lvl = np.zeros((n, len(skill_names)))
    k_index = {s: k for k, s in enumerate(skill_names)}
    for row in skills_long.itertuples(index=False):
        i = soc_index.get(row.soc_code)
        if i is not None:
            k = k_index[row.skill]
            imp[i, k] = row.importance
            lvl[i, k] = row.skill_level

    print(f"Serving set: {n} occupations x {len(skill_names)} skills")

    # --- Pairwise gaps ---------------------------------------------------
    sg = cfg["skill_gap"]
    job_zone = serve["job_zone"].to_numpy(dtype=float)
    gaps = core.skill_gap_matrix(
        imp,
        lvl,
        alpha=sg["alpha"],
        beta=sg["beta"],
        gamma=sg["gamma"],
        job_zone=job_zone,
    )
    task_dist = task_distance_matrix(list(serve["soc_code"]), tasks)
    gaps = gaps + sg["delta"] * task_dist

    wages = serve["wage_median"].to_numpy(dtype=float)
    exposure = serve["exposure_composite"].to_numpy(dtype=float)
    employment = serve["employment"].fillna(0).to_numpy(dtype=float)
    wage_delta = wages[None, :] - wages[:, None]
    exp_delta = exposure[None, :] - exposure[:, None]

    # --- Feasibility + Pareto per origin ---------------------------------
    fr = cfg["frontier"]
    tau_pct = fr["feasibility_tau_percentile"]
    max_jz_up = fr["max_job_zone_step_up"]
    min_emp = fr["min_target_employment"]
    rows: list[dict] = []
    edges: dict[int, list[tuple[int, float, float]]] = {}
    min_wage_pct = cfg["paths"]["min_wage_delta_pct"] / 100.0

    for o in range(n):
        g = gaps[o].copy()
        g[o] = np.inf
        tau = core.feasibility_threshold(g, tau_pct)
        feasible = (
            (g <= tau)
            & (np.arange(n) != o)
            & (job_zone <= job_zone[o] + max_jz_up)
            & (employment >= min_emp)
        )
        idx = np.where(feasible)[0]

        pareto_mask = core.pareto_front(g[idx], wage_delta[o, idx], exp_delta[o, idx])
        pareto_set = set(idx[pareto_mask])

        # 2D envelope (gap asc, wage strictly rising) - what the chart's
        # dashed line connects; the full 3D frontier stays as green dots.
        pareto2d_set: set[int] = set()
        best_wage = -np.inf
        for t in sorted(pareto_set, key=lambda t: g[t]):
            if wage_delta[o, t] > best_wage:
                pareto2d_set.add(t)
                best_wage = wage_delta[o, t]

        edges[o] = [
            (int(t), float(g[t]), float(wage_delta[o, t]))
            for t in idx
            if wage_delta[o, t] > min_wage_pct * wages[o]
        ]

        for t in idx:
            rows.append(
                {
                    "from_soc": serve["soc_code"][o],
                    "to_soc": serve["soc_code"][t],
                    "skill_gap": round(float(g[t]), 4),
                    "wage_delta": round(float(wage_delta[o, t])),
                    "exposure_delta": round(float(exp_delta[o, t]), 4),
                    "pareto": bool(t in pareto_set),
                    "pareto2d": bool(t in pareto2d_set),
                    "feasible": True,
                }
            )

    transitions = pd.DataFrame(rows)

    # --- Escape routes ----------------------------------------------------
    p = cfg["paths"]
    all_paths: dict[str, list[dict]] = {}
    for o in range(n):
        found = core.beam_search_paths(
            edges,
            o,
            wages,
            exposure,
            beam_width=p["beam_width"],
            max_hops=p["max_hops"],
            lambda_gap=p["lambda_gap"],
            mu_exposure=p["mu_exposure"],
            top_k=p["top_k"],
        )
        out = []
        for path in found:
            out.append(
                {
                    "hops": [
                        {
                            "soc_code": serve["soc_code"][i],
                            "title": serve["title"][i],
                            "wage_median": float(wages[i]),
                            "exposure_composite": round(float(exposure[i]), 3),
                        }
                        for i in path["nodes"]
                    ],
                    "cumulative_wage_delta": round(path["cumulative_wage_delta"]),
                    "cumulative_skill_gap": round(path["cumulative_skill_gap"], 3),
                    "final_exposure": round(path["final_exposure"], 3),
                }
            )
        all_paths[serve["soc_code"][o]] = out

    # --- Write artifacts --------------------------------------------------
    ART_DIR.mkdir(parents=True, exist_ok=True)
    serve_out = serve.copy()
    serve_out.to_parquet(ART_DIR / "occupations.parquet", index=False)
    transitions.to_parquet(ART_DIR / "transitions.parquet", index=False)
    skills_long[skills_long["soc_code"].isin(soc_index)].to_parquet(
        ART_DIR / "skills.parquet", index=False
    )
    (ART_DIR / "paths.json").write_text(json.dumps(all_paths))

    # occupations NOT in the serving set stay searchable with an honest reason
    excluded = occ[~occ["soc_code"].isin(soc_index)][["soc_code", "title"]].copy()
    excluded["reason"] = np.where(
        occ[~occ["soc_code"].isin(soc_index)]["wage_median"].isna(),
        "no published median wage (suppressed or top-coded)",
        "no O*NET skill profile (residual category)",
    )
    excluded.to_parquet(ART_DIR / "excluded.parquet", index=False)

    meta = {
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "occupations_serving": int(n),
        "occupations_total": int(len(occ)),
        "transitions": int(len(transitions)),
        "pareto_moves": int(transitions["pareto"].sum()),
        "skills": skill_names,
        "config": cfg,
        "data_vintages": {
            "onet_skills": "O*NET basic skills (via openai/GPTs-are-GPTs, pinned commit)",
            "wages": "BLS OEWS national, May 2021 release",
            "exposure": "AIOE (2021) + OpenAI GPTs-are-GPTs (2023/24) + Microsoft WAI (2025)",
        },
        "precompute_seconds": round(time.time() - t0, 1),
    }
    (ART_DIR / "meta.json").write_text(json.dumps(meta, indent=2))
    print(
        f"Artifacts written: {n} occupations, {len(transitions)} transitions, "
        f"{meta['pareto_moves']} frontier moves, {meta['precompute_seconds']}s"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
