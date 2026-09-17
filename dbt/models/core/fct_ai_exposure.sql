-- Long format: one row per (SOC, source). Raw scales are incompatible, so
-- each source also carries its within-source percentile rank (0..1).
with unioned as (
    select soc_code, 'aioe' as source, aioe_score as score_raw
    from {{ ref('stg_aioe') }}
    where aioe_score is not null

    union all

    select soc_code, 'openai' as source, avg(exposure_beta) as score_raw
    from {{ ref('stg_openai_exposure') }}
    where exposure_beta is not null
    group by 1, 2

    union all

    select soc_code, 'msft' as source, applicability_score as score_raw
    from {{ ref('stg_msft') }}
    where applicability_score is not null
)
select
    soc_code,
    source,
    score_raw,
    percent_rank() over (partition by source order by score_raw) as score_pct_rank
from unioned
