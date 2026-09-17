select
    soc_code,
    employment,
    wage_median,
    wage_topcoded,
    wage_p10,
    wage_p90
from {{ ref('stg_oews_wages') }}
