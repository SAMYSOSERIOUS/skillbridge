-- Top technologies per occupation, DISTINCTIVE first (Fix: "same
-- certifications for every job"). A tool listed by a large share of all
-- occupations (Excel, Word, Outlook, email) tells you nothing about THIS
-- job, so ranking is: hot first, then rarest-across-occupations first.
-- `generic` flags tools listed by more than var('generic_tool_share') of
-- occupations - the UI collapses those into one quiet line. All counts
-- are computed from the real O*NET Technology Skills table.
with counts as (
    select technology, count(distinct soc_code) as n_occs
    from {{ ref('stg_onet_tech') }}
    group by 1
),
total as (
    select count(distinct soc_code) as n_total from {{ ref('stg_onet_tech') }}
),
ranked as (
    select t.soc_code, t.technology, t.hot,
        c.n_occs * 1.0 / total.n_total as share,
        (c.n_occs * 1.0 / total.n_total) > {{ var('generic_tool_share') }} as generic,
        row_number() over (
            partition by t.soc_code
            order by t.hot desc, c.n_occs asc, t.technology
        ) as rn
    from {{ ref('stg_onet_tech') }} t
    join counts c using (technology)
    cross join total
)
select soc_code, technology, hot, generic
from ranked
where rn <= 12
