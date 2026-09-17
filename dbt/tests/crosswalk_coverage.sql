-- Quality gate (docs/04_DATASETS.md D6): at least 95% of matchable
-- occupations that have wage + exposure data must resolve to a skill
-- vector through dim_soc_crosswalk.
-- "All Other" residual SOC categories are excluded from the denominator:
-- O*NET does not publish skill profiles for residuals, so they are
-- unmatchable by design (they remain visible in the app without a BOM).
with servable as (
    select count(*) as total,
           sum(case when has_skills then 1 else 0 end) as with_skills
    from {{ ref('mart_occupations') }}
    where wage_median is not null
      and n_sources >= 2
      and title not ilike '%all other%'
)
select total, with_skills, with_skills * 1.0 / total as coverage
from servable
where with_skills * 1.0 / total < {{ var('min_crosswalk_coverage') }}
