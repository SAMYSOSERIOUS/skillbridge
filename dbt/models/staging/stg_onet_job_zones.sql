select
    "O*NET-SOC Code"                  as onet_soc_code,
    try_cast("Job Zone" as integer)   as job_zone
from read_parquet('data/raw/onet_full/job_zones.parquet')
