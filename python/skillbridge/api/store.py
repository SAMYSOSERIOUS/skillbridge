"""Data access for the API - real artifacts when present, fixture otherwise.

Real mode: reads the precomputed parquet/json artifacts written by
``skillbridge.engine.precompute`` (hard rule 4: the API only serves what
the pipeline computed; it never recomputes analytics).
Sample mode: the clearly-labeled synthetic 5-occupation fixture, used by
CI and `make demo` so no downloads are ever required.
"""

import json
import os
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / os.environ.get("SKILLBRIDGE_DATA", "data")
ART_DIR = DATA_DIR / "artifacts"


def real_mode() -> bool:
    return (ART_DIR / "occupations.parquet").exists()


@lru_cache(maxsize=1)
def load() -> dict:
    if real_mode():
        return _load_real()
    return _load_fixture()


def _load_fixture() -> dict:
    fixture_path = DATA_DIR / "fixture.json"
    if not fixture_path.exists():
        # No artifacts and no fixture at SKILLBRIDGE_DATA: fall back to the
        # bundled sample so a fresh clone (and CI) always has a working app.
        fixture_path = REPO_ROOT / "data" / "sample" / "fixture.json"
    if not fixture_path.exists():
        raise FileNotFoundError(
            f"No artifacts in {ART_DIR} and no fixture found. "
            "Run `make build` (real data) or `make demo` (sample)."
        )
    raw = json.loads(fixture_path.read_text())
    occs = {}
    for o in raw["occupations"]:
        occs[o["soc_code"]] = {
            "soc_code": o["soc_code"],
            "title": o["title"],
            "display_title": o["display_title"],
            "wage_median": o["wage_median"],
            "wage_topcoded": False,
            "employment": None,
            "job_zone": None,
            "exposure": o["exposure"],
            "servable": True,
            "excluded_reason": None,
        }
    return {
        "mode": "sample",
        "synthetic": True,
        "occupations": occs,
        "transitions": raw["transitions"],
        "bom": raw["bom"],
        "paths": raw["paths"],
        "skills": None,
        "meta": {
            "built_at": None,
            "note": "Synthetic demo fixture - not real statistics (data/sample/README.md).",
        },
    }


def _load_real() -> dict:
    import pandas as pd

    occ = pd.read_parquet(ART_DIR / "occupations.parquet")
    transitions = pd.read_parquet(ART_DIR / "transitions.parquet")
    skills = pd.read_parquet(ART_DIR / "skills.parquet")
    excluded = pd.read_parquet(ART_DIR / "excluded.parquet")
    paths = json.loads((ART_DIR / "paths.json").read_text())
    meta = json.loads((ART_DIR / "meta.json").read_text())

    occs: dict[str, dict] = {}
    for r in occ.itertuples(index=False):
        occs[r.soc_code] = {
            "soc_code": r.soc_code,
            "title": r.title,
            "display_title": r.title,
            "wage_median": None if pd.isna(r.wage_median) else float(r.wage_median),
            "wage_topcoded": bool(r.wage_topcoded),
            "employment": None if pd.isna(r.employment) else float(r.employment),
            "job_zone": None if pd.isna(r.job_zone) else round(float(r.job_zone), 1),
            "exposure": {
                "aioe": None if pd.isna(r.pct_aioe) else round(float(r.pct_aioe), 3),
                "openai": None if pd.isna(r.pct_openai) else round(float(r.pct_openai), 3),
                "msft": None if pd.isna(r.pct_msft) else round(float(r.pct_msft), 3),
                "composite": round(float(r.exposure_composite), 3),
                "agreement": bool(r.agreement_flag),
                "n_sources": int(r.n_sources),
            },
            "servable": True,
            "excluded_reason": None,
        }
    for r in excluded.itertuples(index=False):
        occs.setdefault(
            r.soc_code,
            {
                "soc_code": r.soc_code,
                "title": r.title,
                "display_title": r.title,
                "wage_median": None,
                "wage_topcoded": False,
                "employment": None,
                "job_zone": None,
                "exposure": None,
                "servable": False,
                "excluded_reason": r.reason,
            },
        )

    trans_by_origin: dict[str, list[dict]] = {}
    for r in transitions.itertuples(index=False):
        trans_by_origin.setdefault(r.from_soc, []).append(
            {
                "to_soc": r.to_soc,
                "to_title": occs[r.to_soc]["title"],
                "skill_gap": float(r.skill_gap),
                "wage_delta": float(r.wage_delta),
                "exposure_delta": float(r.exposure_delta),
                "pareto": bool(r.pareto),
                "pareto2d": bool(getattr(r, "pareto2d", False)),
                "feasible": bool(r.feasible),
            }
        )

    skill_vectors: dict[str, dict[str, tuple[float, float]]] = {}
    for r in skills.itertuples(index=False):
        skill_vectors.setdefault(r.soc_code, {})[r.skill] = (
            float(r.importance),
            float(r.skill_level),
        )

    return {
        "mode": "real",
        "synthetic": False,
        "occupations": occs,
        "transitions": trans_by_origin,
        "bom": None,  # computed on request from skill_vectors
        "paths": paths,
        "skills": skill_vectors,
        "meta": meta,
    }
