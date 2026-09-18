-- Wages with the ceiling made honest (Fix 3): a top-coded median stays NULL
-- in wage_median (never a guess), but gains a serving FLOOR of $208,000
-- (the release's published top-code threshold) with wage_is_floor = true,
-- so high-pay occupations are no longer invisible to the frontier.
select
    soc_code,
    employment,
    wage_median,
    wage_topcoded,
    case when wage_median is not null then wage_median
         when wage_topcoded then 208000.0 end       as wage_serving,
    (wage_topcoded and wage_median is null)          as wage_is_floor,
    wage_p10,
    wage_p90
from {{ ref('stg_oews_wages') }}
