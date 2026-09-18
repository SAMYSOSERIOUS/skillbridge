-- Quality gate (docs/04_DATASETS.md D6, v2 code-based): at least 95% of the
-- O*NET occupations THAT CARRY DESCRIPTOR DATA must resolve to an OEWS wage
-- row through dim_soc_crosswalk. Aggregate bookkeeping codes in Occupation
-- Data ("All Other" rollups, military codes) have no descriptors and no own
-- OEWS wage row by design, so they are excluded from the denominator - they
-- can never be served, and counting them would let the real join quality
-- drift unnoticed either way. Measured on real May-2021 data: 96.6%.
-- Fails (returns a row) when coverage drops below the gate.
with data_occs as (
    select distinct onet_soc_code from {{ ref('stg_onet_descriptors') }}
),
c as (
    select count(*) as total,
           sum(case when x.has_wage_row then 1 else 0 end) as with_wage
    from {{ ref('dim_soc_crosswalk') }} x
    join data_occs using (onet_soc_code)
)
select total, with_wage, with_wage * 1.0 / total as coverage
from c
where with_wage * 1.0 / total < {{ var('min_crosswalk_coverage') }}
