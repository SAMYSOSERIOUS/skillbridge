"""SkillBridge API (M0 stub).

Serves the endpoint shapes from docs/03_ARCHITECTURE.md §1, backed by the
synthetic fixture in data/sample/ (M0). In M2+ the same endpoints read
precomputed parquet artifacts instead - the response shapes must not change,
which is what the contract tests in tests/test_api.py pin down.

Also serves the static frontend from web/ (hard rule: one process, one image).
"""

import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / os.environ.get("SKILLBRIDGE_DATA", "data/sample")
WEB_DIR = REPO_ROOT / "web"

app = FastAPI(title="SkillBridge API", version="0.1.0")


def _load_fixture() -> dict:
    fixture_path = DATA_DIR / "fixture.json"
    if not fixture_path.exists():
        raise HTTPException(
            status_code=503,
            detail="Data not available. Run `make demo` to use the bundled sample.",
        )
    with open(fixture_path) as f:
        return json.load(f)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "mode": "sample" if "sample" in str(DATA_DIR) else "full"}


@app.get("/api/occupations")
def occupations(q: str = "") -> dict:
    data = _load_fixture()
    needle = q.strip().lower()
    results = [
        {
            "soc_code": o["soc_code"],
            "title": o["title"],
            "display_title": o["display_title"],
        }
        for o in data["occupations"]
        if not needle or needle in o["title"].lower() or needle in o["display_title"].lower()
    ]
    return {"query": q, "results": results[:8]}


@app.get("/api/transitions/{soc}")
def transitions(soc: str) -> dict:
    data = _load_fixture()
    if soc not in data["transitions"]:
        raise HTTPException(
            status_code=404,
            detail="We couldn't match that occupation. Try a broader job title.",
        )
    origin = next(o for o in data["occupations"] if o["soc_code"] == soc)
    return {
        "origin": {
            "soc_code": origin["soc_code"],
            "display_title": origin["display_title"],
            "wage_median": origin["wage_median"],
        },
        "transitions": data["transitions"][soc],
        "synthetic": data.get("synthetic", False),
    }


@app.get("/api/bom/{from_soc}/{to_soc}")
def bom(from_soc: str, to_soc: str) -> dict:
    data = _load_fixture()
    key = f"{from_soc}:{to_soc}"
    if key not in data["bom"]:
        raise HTTPException(
            status_code=404,
            detail="No skill-gap breakdown for this pair yet.",
        )
    return data["bom"][key] | {"synthetic": data.get("synthetic", False)}


@app.get("/api/paths/{soc}")
def paths(soc: str, hops: int = 3) -> dict:
    data = _load_fixture()
    if soc not in data["paths"]:
        raise HTTPException(
            status_code=404,
            detail="No escape routes computed for this occupation yet.",
        )
    return {
        "origin_soc": soc,
        "max_hops": hops,
        "paths": data["paths"][soc],
        "synthetic": data.get("synthetic", False),
    }


@app.get("/api/exposure/{soc}")
def exposure(soc: str) -> dict:
    data = _load_fixture()
    match = [o for o in data["occupations"] if o["soc_code"] == soc]
    if not match:
        raise HTTPException(
            status_code=404,
            detail="We couldn't match that occupation. Try a broader job title.",
        )
    occ = match[0]
    return {
        "soc_code": occ["soc_code"],
        "display_title": occ["display_title"],
        "exposure": occ["exposure"],
        "synthetic": data.get("synthetic", False),
    }


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


app.mount("/", StaticFiles(directory=WEB_DIR), name="web")
