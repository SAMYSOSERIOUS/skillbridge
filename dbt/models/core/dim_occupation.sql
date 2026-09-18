-- One row per 6-digit SOC in scope. Title preference: OEWS > O*NET rollup
-- > AIOE > MSFT.
with onet_titles as (
    select soc_code, min(title) as onet_title
    from {{ ref('stg_onet_occupations') }}
    group by 1
),
spine as (
    select soc_code from {{ ref('stg_oews_wages') }}
    union
    select soc_code from onet_titles
    union
    select soc_code from {{ ref('stg_aioe') }}
    union
    select soc_code from {{ ref('stg_msft') }}
)
select
    s.soc_code,
    coalesce(w.title, o.onet_title, a.title, m.title) as title
from spine s
left join {{ ref('stg_oews_wages') }} w using (soc_code)
left join onet_titles o using (soc_code)
left join {{ ref('stg_aioe') }} a using (soc_code)
left join {{ ref('stg_msft') }} m using (soc_code)
