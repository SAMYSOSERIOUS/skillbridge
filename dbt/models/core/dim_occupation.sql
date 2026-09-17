-- One row per 6-digit SOC in scope. Title preference: OEWS > AIOE > MSFT
-- > first O*NET title rolled up to that SOC.
with onet_titles as (
    select soc_code, min(onet_title) as onet_title
    from {{ ref('stg_openai_exposure') }}
    group by 1
),
spine as (
    select soc_code from {{ ref('stg_oews_wages') }}
    union
    select soc_code from {{ ref('stg_aioe') }}
    union
    select soc_code from {{ ref('stg_msft') }}
    union
    select soc_code from onet_titles
)
select
    s.soc_code,
    coalesce(w.title, a.title, m.title, o.onet_title) as title
from spine s
left join {{ ref('stg_oews_wages') }} w using (soc_code)
left join {{ ref('stg_aioe') }} a using (soc_code)
left join {{ ref('stg_msft') }} m using (soc_code)
left join onet_titles o using (soc_code)
