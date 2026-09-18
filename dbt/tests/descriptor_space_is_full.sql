-- Fix 1 gate: the warehouse must carry the full descriptor space
-- (>= 100 distinct descriptors), not the old 11-skill subset.
select count(distinct skill) as n
from {{ ref('fct_occupation_skill') }}
having count(distinct skill) < 100
