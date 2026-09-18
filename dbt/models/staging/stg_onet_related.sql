-- O*NET's own Related Occupations table - the engine's sanity baseline.
select
    substr("O*NET-SOC Code", 1, 7)          as soc_code,
    substr("Related O*NET-SOC Code", 1, 7)  as related_soc_code,
    "Relatedness Tier"                       as tier
from read_parquet('data/raw/onet_full/related_occupations.parquet')
