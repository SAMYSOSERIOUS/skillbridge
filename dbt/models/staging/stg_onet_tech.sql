-- Real named technologies per occupation (O*NET Technology Skills):
-- Tableau, Microsoft Power BI, SAS, ... with the 'hot technology' flag.
-- This powers the certification pointers in the skill plan.
select distinct
    substr("O*NET-SOC Code", 1, 7)      as soc_code,
    "Example"                            as technology,
    coalesce("Hot Technology", 'N') = 'Y' as hot
from read_parquet('data/raw/onet_full/technology_skills.parquet')
where "Example" is not null
