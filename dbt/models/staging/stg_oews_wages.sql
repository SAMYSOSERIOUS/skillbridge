-- BLS OEWS national wages, May 2021. Detailed, cross-industry rows only.
-- Suppressed cells ('*') become NULL (never 0). Top-coded medians ('#',
-- i.e. >= $208,000/yr in this release) become NULL with wage_topcoded=true.
select
    "OCC_CODE"                                as soc_code,
    "OCC_TITLE"                               as title,
    {{ clean_oews_number('"TOT_EMP"') }}      as employment,
    {{ clean_oews_number('"A_MEDIAN"') }}     as wage_median,
    ("A_MEDIAN" = '#')                        as wage_topcoded,
    {{ clean_oews_number('"A_PCT10"') }}      as wage_p10,
    {{ clean_oews_number('"A_PCT90"') }}      as wage_p90
from read_parquet('data/raw/oews/raw.parquet')
where "O_GROUP" = 'detailed'
  and "I_GROUP" = 'cross-industry'
