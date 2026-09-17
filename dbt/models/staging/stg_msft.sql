-- Microsoft Research AI applicability score (CC BY 4.0). Grain: SOC.
select
    "SOC Code"                                    as soc_code,
    title,
    try_cast(ai_applicability_score as double)    as applicability_score
from read_parquet('data/raw/msft/raw.parquet')
where "SOC Code" is not null
