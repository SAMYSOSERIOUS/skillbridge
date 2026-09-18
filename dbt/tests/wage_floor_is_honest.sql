-- Fix 3 invariant: a floor is exactly the published top-code threshold and
-- only ever applies to top-coded rows whose median is suppressed.
select * from {{ ref('fct_wages') }}
where (wage_is_floor and wage_serving != 208000.0)
   or (wage_is_floor and wage_median is not null)
   or (not wage_is_floor and wage_topcoded and wage_median is null and wage_serving is not null and wage_serving != wage_median)
