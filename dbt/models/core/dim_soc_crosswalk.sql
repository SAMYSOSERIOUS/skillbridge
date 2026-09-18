-- The join spine (hard rule 3), v2: CODE-BASED. With the full O*NET database
-- ingested, every 8-digit O*NET-SOC rolls up to its 6-digit SOC by
-- truncation (the official O*NET-SOC 2019 convention); OEWS wage codes are
-- 6-digit hybrid-SOC. The old name-matching path is retired.
select
    onet_soc_code,
    soc_code,
    (w.soc_code is not null) as has_wage_row
from {{ ref('stg_onet_occupations') }}
left join {{ ref('stg_oews_wages') }} w using (soc_code)
