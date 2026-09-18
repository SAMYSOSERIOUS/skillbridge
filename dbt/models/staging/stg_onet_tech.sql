-- Real named technologies per occupation (O*NET Technology Skills):
-- Tableau, Microsoft Power BI, SAS, ... with the 'hot technology' flag.
-- This powers the certification pointers in the skill plan.
-- Several 8-digit O*NET-SOC codes roll up to one 6-digit SOC, so the same
-- tool can arrive with differing hot flags; keep one row per (soc, tool),
-- hot when ANY source row marks it hot.
select
    substr("O*NET-SOC Code", 1, 7)                   as soc_code,
    "Example"                                         as technology,
    bool_or(coalesce("Hot Technology", 'N') = 'Y')    as hot
from read_parquet('data/raw/onet_full/technology_skills.parquet')
where "Example" is not null
group by 1, 2
