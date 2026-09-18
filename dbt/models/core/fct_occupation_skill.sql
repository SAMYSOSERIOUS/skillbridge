-- Full descriptor space per 6-digit SOC (Fix 1), rolled up through the
-- code crosswalk. Display names disambiguate cross-domain collisions
-- (e.g. Mathematics is both a skill and a knowledge area).
-- Normalization: importance IM/5 -> 0..1, level LV/7 -> 0..1.
with rolled as (
    select
        x.soc_code,
        d.domain,
        d.element_name,
        avg(d.importance_raw) as importance_raw,
        avg(d.level_raw)      as level_raw
    from {{ ref('stg_onet_descriptors') }} d
    join {{ ref('dim_soc_crosswalk') }} x using (onet_soc_code)
    where d.importance_raw is not null
    group by 1, 2, 3
),
names as (
    select *,
        count(distinct domain) over (partition by element_name) as n_domains
    from rolled
)
select
    soc_code,
    domain,
    case
        when n_domains > 1 and domain = 'knowledge' then element_name || ' — knowledge'
        when n_domains > 1 and domain = 'ability'  then element_name || ' — ability'
        else element_name
    end                             as skill,
    importance_raw / 5.0            as importance,
    coalesce(level_raw, 0) / 7.0    as skill_level
from names
