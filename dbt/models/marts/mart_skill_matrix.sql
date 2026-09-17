-- Engine input: normalized 0..1 importance and level per (SOC, skill).
select
    soc_code,
    skill,
    importance / 100.0   as importance,
    coalesce(skill_level, 0) / 100.0 as skill_level
from {{ ref('fct_occupation_skill') }}
