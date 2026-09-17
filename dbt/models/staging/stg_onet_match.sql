-- Occupation-name -> SOC matching table (crosswalk input).
-- Names can repeat; we keep distinct (name, soc) pairs and let
-- dim_soc_crosswalk resolve ambiguity explicitly.
select distinct
    occupation      as occupation_name,
    "OCC_CODE"      as soc_code
from read_parquet('data/raw/onet_match/raw.parquet')
where occupation is not null
  and "OCC_CODE" is not null
