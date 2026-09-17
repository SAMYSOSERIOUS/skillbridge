"""Export the app as a fully static site (GitHub Pages edition).

Writes ``site/``: the single-file frontend (web/index.html, self-contained:
React runtime, Geist fonts, styles and logic are all inside) plus the same
data contract the API serves live under /data/ - built by the shared
builders in skillbridge.api.webdata so Pages and FastAPI can never drift.

Run: python -m skillbridge.export_static  (after `make build`)
"""

import json
import shutil
import sys
from pathlib import Path

from skillbridge.api import store, webdata

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

    shutil.copy(WEB_DIR / "index.html", SITE / "index.html")

    (SITE / "data" / "occupations.json").write_text(json.dumps(webdata.build_occupations(data)))
    (SITE / "data" / "skills.json").write_text(json.dumps(webdata.build_skills(data)))
    (SITE / "data" / "config.json").write_text(json.dumps(webdata.build_config(data)))
    for soc in data["transitions"]:
        bundle = webdata.build_origin(data, soc)
        (SITE / "data" / "origins" / f"{soc}.json").write_text(json.dumps(bundle))

    n_files = sum(1 for _ in SITE.rglob("*") if _.is_file())
    size_mb = sum(f.stat().st_size for f in SITE.rglob("*") if f.is_file()) / 1e6
    print(f"Static site written to site/ - {n_files} files, {size_mb:.1f}MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
