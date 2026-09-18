"""Raw zone normalization: convert every ingested file to parquet, untyped.

Values are kept as strings exactly as published (dbt staging does all typed
casting, so every cleaning decision is visible and tested in SQL). The one
exception is the AIOE workbook, where the single relevant sheet is extracted.

Run: python -m skillbridge.ingest.normalize
"""

import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = REPO_ROOT / "data" / "raw"

CSV_SOURCES = {
    "openai": "occ_level.csv",
    "oews": "national_May2021_dl.csv",
    "msft": "ai_applicability_scores.csv",
}


def main() -> int:
    missing = []
    for key, filename in CSV_SOURCES.items():
        src = RAW_DIR / key / filename
        if not src.exists():
            missing.append(str(src))
            continue
        df = pd.read_csv(src, dtype=str, encoding="utf-8-sig")
        df.to_parquet(RAW_DIR / key / "raw.parquet", index=False)
        print(f"[ ok ] {key}: {len(df)} rows -> raw.parquet")

    tasks_src = RAW_DIR / "onet_tasks" / "full_onet_data.tsv"
    if tasks_src.exists():
        df = pd.read_csv(tasks_src, sep="\t", dtype=str)
        df.to_parquet(RAW_DIR / "onet_tasks" / "raw.parquet", index=False)
        print(f"[ ok ] onet_tasks: {len(df)} rows -> raw.parquet")
    else:
        missing.append(str(tasks_src))

    aioe_src = RAW_DIR / "aioe" / "aioe.xlsx"
    if aioe_src.exists():
        df = pd.read_excel(aioe_src, sheet_name="LM AIOE", dtype=str)
        df.to_parquet(RAW_DIR / "aioe" / "raw.parquet", index=False)
        print(f"[ ok ] aioe: {len(df)} rows -> raw.parquet")
    else:
        missing.append(str(aioe_src))

    if missing:
        print("NORMALIZE FAILED - missing raw files (run `make ingest` first):")
        for m in missing:
            print(f"  - {m}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
