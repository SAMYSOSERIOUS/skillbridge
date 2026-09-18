-- The full descriptor space (Fix 1): 35 skills + 33 knowledge + 52 abilities,
-- importance (IM, 1-5) and level (LV, 0-7) pivoted per occupation.
-- Rows the survey marks 'Recommend Suppress' are excluded (hard rule 2:
-- the drop is counted in the data-quality report, never silent).
{% set tables = {'skills': 'skill', 'knowledge': 'knowledge', 'abilities': 'ability'} %}
with unioned as (
    {% for tbl, domain in tables.items() %}
    select
        "O*NET-SOC Code"                as onet_soc_code,
        '{{ domain }}'                  as domain,
        "Element Name"                  as element_name,
        "Scale ID"                      as scale_id,
        try_cast("Data Value" as double) as data_value
    from read_parquet('data/raw/onet_full/{{ tbl }}.parquet')
    where coalesce("Recommend Suppress", 'N') != 'Y'
      and "Scale ID" in ('IM', 'LV')
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
)
select
    onet_soc_code,
    domain,
    element_name,
    max(case when scale_id = 'IM' then data_value end) as importance_raw,
    max(case when scale_id = 'LV' then data_value end) as level_raw
from unioned
group by 1, 2, 3
