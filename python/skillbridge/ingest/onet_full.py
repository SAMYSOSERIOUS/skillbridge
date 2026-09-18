"""Full O*NET database ingestion (Fix 1) + optional BLS education table (Fix 2).

Downloads the official O*NET text-database zip from onetcenter.org, trying a
cascade of recent release versions (newest first) so the pipeline survives
O*NET's quarterly releases. Extracts only the tables SkillBridge uses and
writes them as string parquet into the raw zone.

Network note: onetcenter.org and bls.gov are reachable from GitHub Actions
and normal machines; some sandboxes only allow GitHub. The O*NET download is
REQUIRED (the descriptor space depends on it). The BLS education table is
OPTIONAL: on failure an empty, schema-correct parquet is written and the app
degrades gracefully (counted in the data-quality report).

Run: python -m skillbridge.ingest.onet_full
"""

import io
import sys
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[3]
RAW = REPO_ROOT / "data" / "raw" / "onet_full"

# Newest first; the release in docs/04_DATASETS.md is pinned by whichever
# succeeds (recorded in data/raw/onet_full/VERSION).
ONET_VERSIONS = ["31_1", "31_0", "30_1", "30_0", "29_3", "29_2"]
ONET_URL = "https://www.onetcenter.org/dl_files/database/db_{v}_text.zip"

# Table name inside the zip -> (output parquet name, minimum expected rows)
ONET_TABLES = {
    "Occupation Data.txt": ("occupation_data", 800),
    "Skills.txt": ("skills", 40000),
    "Knowledge.txt": ("knowledge", 40000),
    "Abilities.txt": ("abilities", 60000),
    "Job Zones.txt": ("job_zones", 800),
    "Technology Skills.txt": ("technology_skills", 20000),
    "Related Occupations.txt": ("related_occupations", 5000),
}

BLS_EDU_URLS = [
    # BLS Employment Projections: education/training assignments by occupation.
    # Cascade of the file locations BLS has used; all are the same table.
    "https://www.bls.gov/emp/ind-occ-matrix/education.xlsx",
    "https://www.bls.gov/emp/tables/education-and-training-by-occupation.xlsx",
    "https://www.bls.gov/emp/ind-occ-matrix/edtrain.xlsx",
]
BLS_EDU_COLUMNS = ["soc_code", "typical_education", "work_experience", "on_the_job_training"]


def _get(url: str, timeout: int = 180) -> bytes:
    # bls.gov returns 403 to obviously non-browser agents; send a full,
    # ordinary browser identity (same public files a browser would fetch).
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def read_onet_table(raw: bytes) -> pd.DataFrame:
    """O*NET text tables are UTF-8, tab-separated, with a header row."""
    return pd.read_csv(io.BytesIO(raw), sep="\t", dtype=str, encoding="utf-8")


def parse_bls_education(raw: bytes) -> pd.DataFrame:
    """Normalize the BLS education/training workbook to BLS_EDU_COLUMNS.

    The sheet layout varies slightly by vintage; we locate the header row by
    the 'Typical entry-level education' column and the SOC-code column by
    pattern (dd-dddd).
    """
    book = pd.read_excel(io.BytesIO(raw), sheet_name=None, header=None, dtype=str)
    for sheet in book.values():
        header_idx = None
        for i in range(min(12, len(sheet))):
            row = " ".join(str(x).lower() for x in sheet.iloc[i].tolist())
            if "typical entry-level education" in row:
                header_idx = i
                break
        if header_idx is None:
            continue
        df = sheet.iloc[header_idx + 1 :].copy()
        df.columns = [str(c).strip().lower() for c in sheet.iloc[header_idx]]
        cols = list(df.columns)

        def find(*needles: str, cols: list[str] = cols) -> str | None:
            for c in cols:
                if all(n in c for n in needles):
                    return c
            return None

        code_col = find("code") or find("matrix", "occupation")
        edu_col = find("typical entry-level education")
        exp_col = find("work experience")
        ojt_col = find("on-the-job training") or find("training")
        if not (code_col and edu_col):
            continue
        out = pd.DataFrame(
            {
                "soc_code": df[code_col].astype(str).str.strip(),
                "typical_education": df[edu_col].astype(str).str.strip(),
                "work_experience": df[exp_col].astype(str).str.strip() if exp_col else "",
                "on_the_job_training": df[ojt_col].astype(str).str.strip() if ojt_col else "",
            }
        )
        out = out[out["soc_code"].str.match(r"^\d{2}-\d{4}$", na=False)]
        if len(out) > 300:
            return out.reset_index(drop=True)
    raise ValueError("education table: no sheet with the expected header found")


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)

    # --- O*NET database (required) ----------------------------------------
    if (RAW / "VERSION").exists() and all(
        (RAW / f"{name}.parquet").exists() for name, _ in ONET_TABLES.values()
    ):
        print(f"[skip] onet_full: already ingested ({(RAW / 'VERSION').read_text().strip()})")
    else:
        # A release is accepted only if EVERY required table parses from it.
        # O*NET 31.0 restructured the database (Skills.txt split into
        # 'Essential Skills'/'Transferable Skills', Technology Skills renamed
        # 'Software Skills'), so the cascade automatically falls back to the
        # newest release with the classic layout. Adopting the 31.0 layout is
        # a documented upgrade (docs/04_DATASETS.md).
        chosen = None
        tables: dict[str, pd.DataFrame] = {}
        last_zip: zipfile.ZipFile | None = None
        for v in ONET_VERSIONS:
            url = ONET_URL.format(v=v)
            try:
                print(f"[try ] O*NET {v}: {url}")
                blob = _get(url)
            except Exception as exc:  # noqa: BLE001 - try the next release
                print(f"[miss] {v}: {exc}")
                continue
            zf = zipfile.ZipFile(io.BytesIO(blob))
            last_zip = zf
            # Case-insensitive basename index: nesting and case vary by release.
            by_base = {Path(n).name.lower(): n for n in zf.namelist()}
            tables = {}
            failures = []
            for fname, (out_name, min_rows) in ONET_TABLES.items():
                member = by_base.get(fname.lower())
                if member is None:
                    failures.append(f"{fname}: not in zip")
                    continue
                df = read_onet_table(zf.read(member))
                if len(df) < min_rows:
                    failures.append(f"{fname}: only {len(df)} rows (expected >= {min_rows})")
                    continue
                tables[out_name] = df
                print(f"[ ok ] {fname}: {len(df)} rows")
            if not failures:
                chosen = v
                break
            print(f"[skip] {v}: layout not supported ({'; '.join(failures)})")
        if chosen is None:
            print(
                "INGEST FAILED: no O*NET release with the expected tables was "
                "reachable. onetcenter.org must be reachable (it is from "
                "GitHub Actions), and if every release changed layout, update "
                "ONET_TABLES and docs/04_DATASETS.md together."
            )
            if last_zip is not None:
                print("Last zip's contents were:")
                for n in sorted(last_zip.namelist()):
                    print(f"    {n}")
            return 1
        for out_name, df in tables.items():
            df.to_parquet(RAW / f"{out_name}.parquet", index=False)
        (RAW / "VERSION").write_text(f"O*NET {chosen.replace('_', '.')} text database\n")
        print(f"[ ok ] O*NET release {chosen.replace('_', '.')} pinned")

    # --- BLS education/training (optional, degrades gracefully) -----------
    edu_path = RAW / "bls_education.parquet"
    if edu_path.exists():
        print("[skip] bls_education: already present")
        return 0
    for url in BLS_EDU_URLS:
        try:
            print(f"[try ] BLS education: {url}")
            df = parse_bls_education(_get(url))
            df.to_parquet(edu_path, index=False)
            print(f"[ ok ] bls_education: {len(df)} rows")
            return 0
        except Exception as exc:  # noqa: BLE001
            print(f"[miss] {exc}")
    print(
        "[warn] BLS education table unavailable - continuing without it "
        "(requirements line degrades; counted in data_quality.md)"
    )
    pd.DataFrame(columns=BLS_EDU_COLUMNS).to_parquet(edu_path, index=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
