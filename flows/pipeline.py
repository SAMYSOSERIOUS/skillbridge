"""The full data pipeline, in order, with fail-fast steps.

    python flows/pipeline.py

Steps: ingest (pinned downloads) -> normalize (raw parquet) ->
dbt build (warehouse + all tests) -> precompute (engine artifacts) ->
quality report. Each step must succeed before the next runs - the
pipeline never continues past broken data (hard rules 1 and 2).
"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

STEPS: list[tuple[str, list[str]]] = [
    ("ingest", [sys.executable, "-m", "skillbridge.ingest.run"]),
    ("ingest O*NET full db", [sys.executable, "-m", "skillbridge.ingest.onet_full"]),
    ("normalize", [sys.executable, "-m", "skillbridge.ingest.normalize"]),
    ("warehouse", ["dbt", "build", "--project-dir", "dbt", "--profiles-dir", "dbt"]),
    ("precompute", [sys.executable, "-m", "skillbridge.engine.precompute"]),
    ("quality report", [sys.executable, "-m", "skillbridge.quality"]),
]


def main() -> int:
    for name, cmd in STEPS:
        print(f"\n=== {name} ===")
        result = subprocess.run(cmd, cwd=REPO_ROOT)
        if result.returncode != 0:
            print(f"\nPIPELINE STOPPED at '{name}' (exit {result.returncode}).")
            return result.returncode
    print("\nPipeline complete. Run `make app` and open http://localhost:8000")
    return 0


if __name__ == "__main__":
    sys.exit(main())
