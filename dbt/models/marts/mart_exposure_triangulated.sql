-- The honest-triangulation mart: per-source percentile ranks side by side,
-- a composite, and an explicit agreement flag. The UI must always show all
-- sources (hard rule 6).
with pivoted as (
    select
        soc_code,
        max(case when source = 'aioe' then score_pct_rank end)   as pct_aioe,
        max(case when source = 'openai' then score_pct_rank end) as pct_openai,
        max(case when source = 'msft' then score_pct_rank end)   as pct_msft,
        count(*)                                                 as n_sources
    from {{ ref('fct_ai_exposure') }}
    group by 1
)
select
    soc_code,
    pct_aioe,
    pct_openai,
    pct_msft,
    n_sources,
    (coalesce(pct_aioe, 0) + coalesce(pct_openai, 0) + coalesce(pct_msft, 0))
        / n_sources as exposure_composite,
    case when n_sources >= 2 then
        greatest(coalesce(pct_aioe, 0), coalesce(pct_openai, 0), coalesce(pct_msft, 0))
        - least(coalesce(pct_aioe, 1), coalesce(pct_openai, 1), coalesce(pct_msft, 1))
        <= {{ var('agreement_spread') }}
    else false end as agreement_flag
from pivoted
