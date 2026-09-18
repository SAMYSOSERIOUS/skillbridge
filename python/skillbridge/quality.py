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
ART_DIR = REPO_ROOT / "data" / "artifacts"
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
    n_floors = q("select count(*) from fct_wages where wage_is_floor")
    n_suppressed = q(
        "select count(*) from fct_wages where wage_median is null and not wage_topcoded"
    )
    n_exposure = q("select count(*) from fct_ai_exposure")
    n_all3 = q("select count(*) from mart_exposure_triangulated where n_sources = 3")
    n_disagree = q(
        "select count(*) from mart_exposure_triangulated "
        "where not agreement_flag and n_sources >= 2"
    )
    # Crosswalk v2 is code-based: 8-digit O*NET-SOC -> 6-digit SOC by truncation.
    n_xwalk = q("select count(*) from dim_soc_crosswalk")
    n_xwalk_wage = q("select count(*) from dim_soc_crosswalk where has_wage_row")
    n_soc6 = q("select count(distinct soc_code) from dim_soc_crosswalk")
    n_skills_dims = q("select count(distinct skill) from mart_skill_matrix")
    n_tech_rows = q("select count(*) from mart_tech")
    n_tech_socs = q("select count(distinct soc_code) from mart_tech")
    n_edu = q("select count(*) from stg_education")
    edu_src = q("select coalesce(min(education_source), '') from stg_education")

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
    onet_raw = REPO_ROOT / "data" / "raw" / "onet_full"
    if (onet_raw / "VERSION").exists():
        lines += [
            "",
            f"## O*NET full database ({(onet_raw / 'VERSION').read_text().strip()})",
            "",
            "| table | rows |",
            "|---|---|",
        ]
        for pq in sorted(onet_raw.glob("*.parquet")):
            n_rows = q(f"select count(*) from read_parquet('{pq.as_posix()}')")
            lines.append(f"| {pq.stem} | {n_rows} |")

    servable = q(
        "select count(*) from mart_occupations "
        "where wage_serving is not null and n_sources >= 2 and has_skills"
    )
    xwalk_cov = (100.0 * n_xwalk_wage / n_xwalk) if n_xwalk else 0.0
    lines += [
        "",
        "## Warehouse",
        "",
        f"- Occupations in spine (`dim_occupation`): **{n_spine}**",
        f"- Servable occupations (wage + >=2 exposure sources + skills): **{servable}**",
        f"- Skill space: **{n_skills_dims}** O*NET descriptors "
        "(skills + knowledge + abilities; Fix 1 - was 11).",
        f"- Wage rows: **{n_wages}**, of which **{n_topcoded}** top-coded. "
        f"**{n_floors}** of those have no published median and are served as the "
        "honest floor **>= $208,000/yr** (`wage_is_floor`, shown with a >= in the UI; "
        f"never a guess), and **{n_suppressed}** are suppressed (stored as NULL, never 0).",
        f"- Exposure rows: **{n_exposure}** across 3 sources; **{n_all3}** occupations "
        f"have all three, **{n_disagree}** have disagreeing sources "
        "(shown honestly in the UI).",
        f"- Technology Skills (real named tools, certification pointers): "
        f"**{n_tech_rows}** rows across **{n_tech_socs}** occupations.",
        "- Education/training assignments (optional): "
        + (
            f"**{n_edu}** occupations, source: **{edu_src}**."
            if n_edu
            else "**unavailable this build** - requirements fall back to O*NET Job Zones."
        ),
        "",
        "## Crosswalk (`dim_soc_crosswalk`, v2: code-based)",
        "",
        f"- O*NET-SOC codes (8-digit): **{n_xwalk}**, rolled up to "
        f"**{n_soc6}** 6-digit SOC codes by truncation (official O*NET-SOC 2019 convention).",
        f"- With an OEWS wage row: **{n_xwalk_wage}** ({xwalk_cov:.1f}%; dbt-gated).",
    ]

    excluded_path = ART_DIR / "excluded.parquet"
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

    meta_path = ART_DIR / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())
        rv = meta.get("related_validation_top_quartile")
        rp = meta.get("related_pairs_checked", 0)
        if rv is not None:
            lines += [
                "",
                "## Engine sanity check",
                "",
                f"- Of **{rp}** O*NET Related-Occupations pairs inside the serving set, "
                f"**{rv:.0%}** rank in the origin's closest skill-gap quartile "
                "(the engine's distance agrees with O*NET's own similarity judgments).",
            ]

    lines += [
        "",
        "## Known limitations",
        "",
        "- Wages: national medians, May 2021 OEWS release; no cost-of-living adjustment.",
        "- US edition: all datasets are US taxonomies (O*NET-SOC / OEWS). "
        "An EU edition (ESCO) is documented as planned, not mixed in.",
        "- Exposure indices measure exposure, not certain displacement.",
        "- Certification pointers are real O*NET-listed technologies linked to "
        "real search pages; SkillBridge never invents a certification.",
    ]
    OUT.write_text("\n".join(lines) + "\n")
    print(f"Wrote {OUT} ({len(lines)} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
