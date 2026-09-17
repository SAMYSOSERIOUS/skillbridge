"""Export the app as a fully static site (GitHub Pages edition).

Reads the precomputed artifacts and writes ``site/``: the web frontend plus
all answers as JSON files, so the app runs with no server at all. The
FastAPI product remains authoritative; this is a faithful static export
(docs/03_ARCHITECTURE.md §5, static edition).

Run: python -m skillbridge.export_static  (after `make build`)
"""

import json
import shutil
import sys
from pathlib import Path

from skillbridge.api import store
from skillbridge.api.main import pick_best_moves
from skillbridge.config import load_config

REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_DIR = REPO_ROOT / "web"
SITE = REPO_ROOT / "site"


def main() -> int:
    data = store.load()
    if data["mode"] != "real":
        print("Static export needs real artifacts - run `make build` first.")
        return 1

    if SITE.exists():
        shutil.rmtree(SITE)
    (SITE / "data" / "origins").mkdir(parents=True)

    # --- frontend files, with absolute paths made relative -----------------
    for name in ("styles.css", "app.js", "plotly.min.js"):
        shutil.copy(WEB_DIR / name, SITE / name)
    html = (WEB_DIR / "index.html").read_text()
    for asset in ("styles.css", "app.js", "plotly.min.js"):
        html = html.replace(f'"/{asset}"', f'"./{asset}"')
    html = html.replace("<script ", "<script>window.SB_STATIC = true;</script>\n  <script ", 1)
    (SITE / "index.html").write_text(html)

    # --- occupations (search + exposure + origin info) ---------------------
    occs = {}
    for soc, o in data["occupations"].items():
        occs[soc] = {
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
    (SITE / "data" / "occupations.json").write_text(json.dumps(occs))

    # --- per-origin bundles: transitions + best move + paths ---------------
    for soc, trans in data["transitions"].items():
        origin = data["occupations"][soc]
        origin_wage = origin["wage_median"] or 0
        best, closest = pick_best_moves(trans, origin_wage)
        bundle = {
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
            "synthetic": False,
        }
        (SITE / "data" / "origins" / f"{soc}.json").write_text(json.dumps(bundle))

    # --- skill matrix + config (client renders BOM tiers from these) -------
    skills = {
        soc: {skill: [round(im, 4), round(lv, 4)] for skill, (im, lv) in vec.items()}
        for soc, vec in data["skills"].items()
    }
    (SITE / "data" / "skills.json").write_text(json.dumps(skills))

    cfg = load_config()
    (SITE / "data" / "config.json").write_text(
        json.dumps({"bom": cfg["bom"], "meta": data["meta"]})
    )

    n_files = sum(1 for _ in SITE.rglob("*") if _.is_file())
    size_mb = sum(f.stat().st_size for f in SITE.rglob("*") if f.is_file()) / 1e6
    print(f"Static site written to site/ - {n_files} files, {size_mb:.1f}MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
