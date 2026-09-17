"""SkillBridge API - serves precomputed answers plus the static frontend.

Response shapes are pinned by tests/test_api.py (load-bearing contract
tests: the browser depends entirely on them). Endpoints work identically
in real mode (data/artifacts) and sample mode (synthetic fixture).
"""

from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from skillbridge.api import store
from skillbridge.config import load_config
from skillbridge.engine import core

REPO_ROOT = Path(__file__).resolve().parents[3]
WEB_DIR = REPO_ROOT / "web"

NOT_FOUND_MSG = "We couldn't match that occupation. Try a broader job title."

app = FastAPI(title="SkillBridge API", version="1.0.0")


def _score(t: dict, origin_wage: float) -> float:
    """Balanced ranking score - same shape as the path score (config docs)."""
    cfg = load_config()["paths"]
    return (
        t["wage_delta"] / max(origin_wage, 1.0)
        - cfg["lambda_gap"] * t["skill_gap"]
        - cfg["mu_exposure"] * max(t["exposure_delta"], 0.0)
    )


@app.get("/api/health")
def health() -> dict:
    data = store.load()
    return {"status": "ok", "mode": data["mode"]}


@app.get("/api/occupations")
def occupations(q: str = "") -> dict:
    data = store.load()
    tokens = [t for t in q.strip().lower().split() if t]
    scored: list[tuple[float, dict]] = []
    for o in data["occupations"].values():
        hay = f"{o['title']} {o['display_title']}".lower()
        hits = sum(1 for t in tokens if t in hay)
        if tokens and hits == 0:
            continue
        emp = o["employment"] or 0
        scored.append((hits * 1e12 + emp, o))
    scored.sort(key=lambda x: x[0], reverse=True)
    return {
        "query": q,
        "results": [
            {
                "soc_code": o["soc_code"],
                "title": o["title"],
                "display_title": o["display_title"],
                "servable": o["servable"],
            }
            for _, o in scored[:8]
        ],
    }


def _get_occupation(data: dict, soc: str) -> dict:
    occ = data["occupations"].get(soc)
    if occ is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND_MSG)
    return occ


@app.get("/api/transitions/{soc}")
def transitions(soc: str) -> dict:
    data = store.load()
    occ = _get_occupation(data, soc)
    if not occ["servable"]:
        raise HTTPException(
            status_code=422,
            detail=f"'{occ['title']}' can't be analyzed: {occ['excluded_reason']}.",
        )
    trans = data["transitions"].get(soc, [])
    if not trans:
        raise HTTPException(status_code=404, detail=NOT_FOUND_MSG)

    origin_wage = occ["wage_median"] or 0
    positive_pareto = [t for t in trans if t["pareto"] and t["wage_delta"] > 0]
    best = max(positive_pareto, key=lambda t: _score(t, origin_wage), default=None)

    return {
        "origin": {
            "soc_code": occ["soc_code"],
            "display_title": occ["display_title"],
            "wage_median": occ["wage_median"],
            "job_zone": occ["job_zone"],
        },
        "transitions": trans,
        "best_move": best,
        "synthetic": data["synthetic"],
    }


@app.get("/api/bom/{from_soc}/{to_soc}")
def bom(from_soc: str, to_soc: str) -> dict:
    data = store.load()
    origin = _get_occupation(data, from_soc)
    target = _get_occupation(data, to_soc)

    if data["mode"] == "sample":
        entry = data["bom"].get(f"{from_soc}:{to_soc}")
        if entry is None:
            raise HTTPException(status_code=404, detail="No skill-gap breakdown for this pair yet.")
        return entry | {"synthetic": True}

    vecs = data["skills"]
    if from_soc not in vecs or to_soc not in vecs:
        raise HTTPException(
            status_code=422,
            detail="One of these occupations has no O*NET skill profile (residual category).",
        )
    skills = sorted(set(vecs[from_soc]) | set(vecs[to_soc]))
    o_lv = np.array([vecs[from_soc].get(s, (0, 0))[1] for s in skills])
    t_lv = np.array([vecs[to_soc].get(s, (0, 0))[1] for s in skills])
    t_im = np.array([vecs[to_soc].get(s, (0, 0))[0] for s in skills])
    cfg = load_config()["bom"]
    tiers = core.bom_tiers(
        o_lv,
        t_lv,
        t_im,
        skills,
        relevant_importance_min=cfg["relevant_importance_min"],
        transferable_tolerance=cfg["transferable_tolerance"],
        upgrade_floor_ratio=cfg["upgrade_floor_ratio"],
    )
    wage_delta = None
    if origin["wage_median"] is not None and target["wage_median"] is not None:
        wage_delta = target["wage_median"] - origin["wage_median"]
    exposure_delta = None
    if origin["exposure"] and target["exposure"]:
        exposure_delta = round(target["exposure"]["composite"] - origin["exposure"]["composite"], 3)
    return {
        "from_title": origin["display_title"],
        "to_title": target["display_title"],
        "wage_delta": wage_delta,
        "exposure_delta": exposure_delta,
        "transferable": tiers["transferable"],
        "upgrade": tiers["upgrade"],
        "acquire": tiers["acquire"],
        "synthetic": False,
    }


@app.get("/api/paths/{soc}")
def paths(soc: str, hops: int = 3) -> dict:
    data = store.load()
    _get_occupation(data, soc)
    found = data["paths"].get(soc)
    if found is None:
        raise HTTPException(
            status_code=404, detail="No escape routes computed for this occupation yet."
        )
    return {
        "origin_soc": soc,
        "max_hops": hops,
        "paths": found,
        "synthetic": data["synthetic"],
    }


@app.get("/api/exposure/{soc}")
def exposure(soc: str) -> dict:
    data = store.load()
    occ = _get_occupation(data, soc)
    if occ["exposure"] is None:
        raise HTTPException(
            status_code=422,
            detail=f"No AI-exposure data for '{occ['title']}'.",
        )
    return {
        "soc_code": occ["soc_code"],
        "display_title": occ["display_title"],
        "exposure": occ["exposure"],
        "synthetic": data["synthetic"],
    }


@app.get("/api/meta")
def meta() -> dict:
    data = store.load()
    return {"mode": data["mode"], "synthetic": data["synthetic"], **data["meta"]}


@app.get("/api/card/{from_soc}/{to_soc}")
def card(from_soc: str, to_soc: str) -> Response:
    from skillbridge.cards.render import render_card

    bom_data = bom(from_soc, to_soc)
    png = render_card(bom_data)
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Content-Disposition": (f'attachment; filename="skillbridge_{from_soc}_{to_soc}.png"')
        },
    )


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


app.mount("/", StaticFiles(directory=WEB_DIR), name="web")
