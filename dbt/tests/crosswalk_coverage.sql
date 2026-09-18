-- Quality gate (docs/04_DATASETS.md D6, v2 code-based): at least 95% of
-- O*NET occupations must resolve to an OEWS wage row through
-- dim_soc_crosswalk. Fails (returns a row) when coverage drops below that.
with c as (
    select count(*) as total,
           sum(case when has_wage_row then 1 else 0 end) as with_wage
    from {{ ref('dim_soc_crosswalk') }}
)
select total, with_wage, with_wage * 1.0 / total as coverage
from c
where with_wage * 1.0 / total < {{ var('min_crosswalk_coverage') }}
