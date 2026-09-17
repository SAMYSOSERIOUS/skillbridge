-- A top-coded wage ('#') must be NULL + flagged, not a fabricated number.
select * from {{ ref('fct_wages') }} where wage_topcoded and wage_median is not null
