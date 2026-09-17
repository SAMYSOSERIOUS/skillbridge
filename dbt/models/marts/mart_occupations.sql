-- The serving spine: occupations that have a title, a wage (or top-coded
-- wage), at least one exposure source, and a skill vector. This is what
-- the engine and the API work from.
with jz as (
    select soc_code, avg(job_zone) as job_zone
    from {{ ref('fct_occupation_skill') }}
    group by 1
)
select
    d.soc_code,
    d.title,
    w.wage_median,
    w.wage_topcoded,
    w.employment,
    e.pct_aioe,
    e.pct_openai,
    e.pct_msft,
    e.n_sources,
    e.exposure_composite,
    e.agreement_flag,
    (sk.soc_code is not null) as has_skills,
    jz.job_zone
from {{ ref('dim_occupation') }} d
left join {{ ref('fct_wages') }} w using (soc_code)
left join {{ ref('mart_exposure_triangulated') }} e using (soc_code)
left join (select distinct soc_code from {{ ref('fct_occupation_skill') }}) sk
    using (soc_code)
left join jz using (soc_code)
