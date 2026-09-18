-- Full O*NET occupation spine (Fix 1). 8-digit O*NET-SOC codes.
select
    "O*NET-SOC Code"               as onet_soc_code,
    substr("O*NET-SOC Code", 1, 7) as soc_code,
    "Title"                        as title,
    "Description"                  as description
from read_parquet('data/raw/onet_full/occupation_data.parquet')
where "O*NET-SOC Code" is not null
