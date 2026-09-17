"""Ingestion: download pinned real source files into data/raw/ and validate.

- Idempotent: a file whose sha256 already matches the manifest is not
  re-downloaded.
- Validating: row counts below the per-source minimum abort the run
  (hard rule 1: never continue on broken data).
- Everything is recorded in data/raw/manifest.json (no silent anything).

Run: python -m skillbridge.ingest.run
"""

import hashlib
import json
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

from skillbridge.ingest.sources import SOURCES

REPO_ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = REPO_ROOT / "data" / "raw"
MANIFEST = RAW_DIR / "manifest.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def count_rows(path: Path) -> int:
    if path.suffix == ".xlsx":
        import pandas as pd

        return sum(len(pd.read_excel(path, sheet_name=s)) for s in ["LM AIOE"])
    with open(path, "rb") as f:
        return max(sum(1 for _ in f) - 1, 0)  # minus header


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"files": {}}


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    failures: list[str] = []

    for src in SOURCES:
        dest_dir = RAW_DIR / src.key
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / src.filename
        entry = manifest["files"].get(src.key)

        if dest.exists() and entry and entry.get("sha256") == sha256(dest):
            print(f"[skip] {src.key}: already ingested ({entry['rows']} rows)")
            continue

        print(f"[get ] {src.key}: {src.url}")
        try:
            req = urllib.request.Request(src.url, headers={"User-Agent": "skillbridge-ingest"})
            with urllib.request.urlopen(req, timeout=120) as resp, open(dest, "wb") as out:
                out.write(resp.read())
        except Exception as exc:  # noqa: BLE001 - report every failure kind
            failures.append(f"{src.key}: download failed ({exc})")
            continue

        rows = count_rows(dest)
        if rows < src.min_rows:
            failures.append(
                f"{src.key}: only {rows} rows (expected >= {src.min_rows}) - "
                "schema or source may have changed; see docs/04_DATASETS.md"
            )
            continue

        manifest["files"][src.key] = {
            "filename": src.filename,
            "url": src.url,
            "sha256": sha256(dest),
            "rows": rows,
            "ingested_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "description": src.description,
        }
        print(f"[ ok ] {src.key}: {rows} rows")

    MANIFEST.write_text(json.dumps(manifest, indent=2))

    if failures:
        print("\nINGEST FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"\nIngest complete: {len(manifest['files'])} sources in {RAW_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
