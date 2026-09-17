"""Auto-generated data-quality report (hard rule 2: no silent drops).

Writes data/data_quality.md from the raw manifest, the warehouse, and the
artifacts. Run: python -m skillbridge.quality
"""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = REPO_ROOT / "data" / "skillbridge.duckdb"
OUT = REPO_ROOT / "data" / "data_quality.md"


def main() -> int:
    if not DB_PATH.exists():
        print("No warehouse - run `make build` first.")
        return 1
    con = duckdb.connect(str(DB_PATH), read_only=True)
    q = lambda sql: con.execute(sql).fetchone()[0]  # noqa: E731
    n_spine = q("select count(*) from dim_occupation")
    n_wages = q("select count(*) from fct_wages")
    n_topcoded = q("select count(*) from fct_wages where wage_topcoded")
    n_suppressed = q(
        "select count(*) from fct_wages where wage_median is null and not wage_topcoded"
    )
    n_exposure = q("select count(*) from fct_ai_exposure")
    n_all3 = q("select count(*) from mart_exposure_triangulated where n_sources = 3")
    n_disagree = q(
        "select count(*) from mart_exposure_triangulated "
        "where not agreement_flag and n_sources >= 2"
    )
    n_xwalk = q("select count(*) from dim_soc_crosswalk")
    n_explicit = q("select count(*) from dim_soc_crosswalk where match_source = 'explicit'")
    n_fallback = q("select count(*) from dim_soc_crosswalk where match_source = 'onet_title'")
    n_ambiguous = q("select count(*) from dim_soc_crosswalk where was_ambiguous")

    manifest = json.loads((REPO_ROOT / "data" / "raw" / "manifest.json").read_text())
    lines = [
        "# Data quality report",
        "",
        f"Generated {datetime.now(UTC).isoformat(timespec='seconds')} "
        "by `python -m skillbridge.quality`. Nothing in the pipeline is dropped "
        "silently; every filter is counted here.",
        "",
        "## Sources ingested (pinned commits, checksummed)",
        "",
        "| source | rows | file |",
        "|---|---|---|",
    ]
    for key, e in manifest["files"].items():
        lines.append(f"| {key} | {e['rows']} | `{e['filename']}` |")

    servable = q(
        "select count(*) from mart_occupations "
        "where wage_median is not null and n_sources >= 2 and has_skills"
    )
    lines += [
        "",
        "## Warehouse",
        "",
        f"- Occupations in spine (`dim_occupation`): **{n_spine}**",
        f"- Servable occupations (wage + >=2 exposure sources + skills): **{servable}**",
        f"- Wage rows: **{n_wages}**, of which **{n_topcoded}** top-coded "
        "(median >= $208,000/yr in the May 2021 release; stored as NULL + flag, "
        f"never a guess) and **{n_suppressed}** suppressed (stored as NULL, never 0).",
        f"- Exposure rows: **{n_exposure}** across 3 sources; **{n_all3}** occupations "
        f"have all three, **{n_disagree}** have disagreeing sources "
        "(shown honestly in the UI).",
        "",
        "## Crosswalk (`dim_soc_crosswalk`)",
        "",
        f"- Names mapped: **{n_xwalk}** (explicit: {n_explicit}, title-fallback: {n_fallback})",
        "- Ambiguous names (several SOC candidates, resolved deterministically): "
        f"**{n_ambiguous}**",
    ]
    unmatched = con.execute(
        """
        select s.occupation_name
        from (select distinct occupation_name from stg_onet_skills) s
        left join dim_soc_crosswalk x using (occupation_name)
        where x.soc_code is null
        order by 1
        """
    ).fetchall()
    lines.append(f"- Skills-file names left unmatched: **{len(unmatched)}**")
    for (name,) in unmatched:
        lines.append(f"  - {name}")

    excluded_path = REPO_ROOT / "data" / "artifacts" / "excluded.parquet"
    if excluded_path.exists():
        import pandas as pd

        ex = pd.read_parquet(excluded_path)
        lines += [
            "",
            "## Occupations excluded from analysis (still searchable, with the reason shown)",
            "",
        ]
        for reason, grp in ex.groupby("reason"):
            lines.append(f"- {reason}: **{len(grp)}**")

    lines += [
        "",
        "## Known limitations",
        "",
        "- Wages: national medians, May 2021 OEWS release; no cost-of-living adjustment.",
        "- Skill space: the 11 O*NET basic skills + Job Zones + task-text similarity; "
        "the full 200+ O*NET descriptor space is a documented extension (docs/04_DATASETS.md).",
        "- Exposure indices measure exposure, not certain displacement.",
    ]
    OUT.write_text("\n".join(lines) + "\n")
    print(f"Wrote {OUT} ({len(lines)} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
