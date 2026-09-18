-- Engine input: normalized 0..1 importance and level per (SOC, descriptor),
-- now over the full ~120-descriptor O*NET space.
select soc_code, domain, skill, importance, skill_level
from {{ ref('fct_occupation_skill') }}
