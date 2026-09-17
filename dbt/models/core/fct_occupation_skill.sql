-- Skills joined to SOC codes through the crosswalk (hard rule 3).
-- Several O*NET occupation names can roll up to one SOC; values average.
select
    x.soc_code,
    s.skill,
    avg(s.importance)   as importance,
    avg(s.skill_level)  as skill_level,
    avg(s.job_zone)     as job_zone
from {{ ref('stg_onet_skills') }} s
join {{ ref('dim_soc_crosswalk') }} x using (occupation_name)
where s.importance is not null
group by 1, 2
