-- The serving spine (v2): wage_serving includes honest $208k floors, the
-- job zone comes from O*NET's own Job Zones table, and BLS education
-- columns appear when the optional table was available.
with jz as (
    select x.soc_code, round(avg(z.job_zone)) as job_zone
    from {{ ref('stg_onet_job_zones') }} z
    join {{ ref('dim_soc_crosswalk') }} x using (onet_soc_code)
    group by 1
)
select
    d.soc_code,
    d.title,
    w.wage_median,
    w.wage_serving,
    w.wage_is_floor,
    w.wage_topcoded,
    w.employment,
    e.pct_aioe,
    e.pct_openai,
    e.pct_msft,
    e.n_sources,
    e.exposure_composite,
    e.agreement_flag,
    (sk.soc_code is not null) as has_skills,
    jz.job_zone,
    edu.typical_education,
    edu.work_experience,
    edu.on_the_job_training
from {{ ref('dim_occupation') }} d
left join {{ ref('fct_wages') }} w using (soc_code)
left join {{ ref('mart_exposure_triangulated') }} e using (soc_code)
left join (select distinct soc_code from {{ ref('fct_occupation_skill') }}) sk
    using (soc_code)
left join jz using (soc_code)
left join {{ ref('stg_bls_education') }} edu using (soc_code)
