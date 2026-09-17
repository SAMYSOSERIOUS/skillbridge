"""Builders for the frontend's data contract (./data/*.json).

One source of truth used by BOTH:
- skillbridge.export_static  -> writes these as files for GitHub Pages
- skillbridge.api.main       -> serves them live under /data/ (make app,
  and CI demo mode on the synthetic fixture)

The UI consumes only these shapes; everything in them was precomputed by
the pipeline (or comes from the clearly-labeled sample fixture).
"""

from functools import lru_cache

from skillbridge.api import store
from skillbridge.api.scoring import pick_best_moves
from skillbridge.config import load_config


def build_occupations(data: dict) -> dict:
    out = {}
    for soc, o in data["occupations"].items():
        out[soc] = {
            "soc_code": o["soc_code"],
            "title": o["title"],
            "display_title": o["display_title"],
            "wage_median": o["wage_median"],
            "job_zone": o["job_zone"],
            "employment": o["employment"],
            "exposure": o["exposure"],
            "servable": o["servable"],
            "excluded_reason": o["excluded_reason"],
        }
    return out


def build_origin(data: dict, soc: str) -> dict | None:
    trans = data["transitions"].get(soc)
    if trans is None:
        return None
    origin = data["occupations"][soc]
    best, closest = pick_best_moves(trans, origin["wage_median"] or 0)
    return {
        "origin": {
            "soc_code": origin["soc_code"],
            "display_title": origin["display_title"],
            "wage_median": origin["wage_median"],
            "job_zone": origin["job_zone"],
        },
        "transitions": trans,
        "best_move": best,
        "best_close": closest,
        "paths": data["paths"].get(soc, []),
        "synthetic": data["synthetic"],
    }


def build_skills(data: dict) -> dict:
    if not data["skills"]:
        return {}
    return {
        soc: {skill: [round(im, 4), round(lv, 4)] for skill, (im, lv) in vec.items()}
        for soc, vec in data["skills"].items()
    }


@lru_cache(maxsize=1)
def _no_move_example() -> dict | None:
    """A real occupation whose frontier holds no positive-pay move - the
    'you're already at the top' demo. Highest-wage such origin wins."""
    data = store.load()
    best_candidate = None
    for soc, trans in data["transitions"].items():
        if any(t["pareto"] and t["wage_delta"] > 0 for t in trans):
            continue
        occ = data["occupations"][soc]
        wage = occ["wage_median"] or 0
        if best_candidate is None or wage > best_candidate[0]:
            best_candidate = (wage, {"soc": soc, "title": occ["display_title"]})
    return best_candidate[1] if best_candidate else None


def build_config(data: dict) -> dict:
    cfg = load_config()
    meta = dict(data["meta"])
    meta["no_move_example"] = _no_move_example()
    meta["synthetic"] = data["synthetic"]
    return {"bom": cfg["bom"], "meta": meta}
