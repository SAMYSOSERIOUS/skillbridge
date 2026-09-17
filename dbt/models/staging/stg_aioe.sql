-- Felten/Raj/Seamans AIOE index (language-modeling variant). Grain: SOC.
select
    "SOC Code"                                      as soc_code,
    "Occupation Title"                              as title,
    try_cast("Language Modeling AIOE" as double)    as aioe_score
from read_parquet('data/raw/aioe/raw.parquet')
where "SOC Code" is not null
