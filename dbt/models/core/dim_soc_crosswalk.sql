-- The join spine (hard rule 3: every cross-source join goes through here).
-- Grain: occupation_name (as it appears in the O*NET skills file).
--
-- Match strategy, in priority order:
--   1. explicit  - the published name->SOC matching table
--   2. onet_title - exact (case/punct-insensitive) match against the
--                   O*NET occupation titles in the OpenAI spine, rolled
--                   up to 6-digit SOC
-- Ambiguous names resolve to the SOC that also appears in the wage file,
-- then lexicographically first - deterministic, and counted in the
-- data-quality report. Unmatched names are NOT dropped silently: they are
-- visible as skills-file names absent from this table (reported).
with norm_openai as (
    select
        lower(regexp_replace(onet_title, '[^a-z0-9]+', ' ', 'gi')) as norm_name,
        soc_code
    from {{ ref('stg_openai_exposure') }}
),
explicit as (
    select occupation_name, soc_code, 'explicit' as match_source
    from {{ ref('stg_onet_match') }}
),
fallback as (
    select
        s.occupation_name,
        o.soc_code,
        'onet_title' as match_source
    from (select distinct occupation_name from {{ ref('stg_onet_skills') }}) s
    join norm_openai o
      on lower(regexp_replace(s.occupation_name, '[^a-z0-9]+', ' ', 'gi')) = o.norm_name
    where s.occupation_name not in (select occupation_name from explicit)
),
unioned as (
    select * from explicit
    union all
    select * from fallback
),
ranked as (
    select
        u.occupation_name,
        u.soc_code,
        u.match_source,
        count(*) over (partition by u.occupation_name) as n_candidates,
        row_number() over (
            partition by u.occupation_name
            order by (w.soc_code is not null) desc, u.soc_code
        ) as rn
    from unioned u
    left join {{ ref('stg_oews_wages') }} w using (soc_code)
)
select
    occupation_name,
    soc_code,
    match_source,
    n_candidates > 1 as was_ambiguous
from ranked
where rn = 1
