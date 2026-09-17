-- OpenAI/Eloundou et al. occupation-level LLM exposure (MIT).
-- Grain: 8-digit O*NET-SOC. beta = E1 + 0.5*E2 (the paper's headline
-- aggregation); we use the HUMAN annotations, not the model's.
select
    "O*NET-SOC Code"                       as onet_soc_code,
    substr("O*NET-SOC Code", 1, 7)         as soc_code,
    "Title"                                as onet_title,
    try_cast(human_rating_beta as double)  as exposure_beta
from read_parquet('data/raw/openai/raw.parquet')
where "O*NET-SOC Code" is not null
