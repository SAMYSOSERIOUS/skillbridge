-- Top technologies per occupation: hot technologies first, then A-Z,
-- capped at 12 for the UI.
with ranked as (
    select *,
        row_number() over (
            partition by soc_code
            order by hot desc, technology
        ) as rn
    from {{ ref('stg_onet_tech') }}
)
select soc_code, technology, hot
from ranked
where rn <= 12
