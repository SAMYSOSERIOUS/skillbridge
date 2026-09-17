-- O*NET basic skills: importance + level per occupation, long format.
-- Source publishes 0-100 scaled values; 'Not relevant' means the level
-- question was not asked (level 0 by O*NET convention); 'Not available'
-- becomes NULL and is counted in the data-quality report.
{% set skills = {
    'Active_Learning': 'Active learning',
    'Critical_Thinking': 'Critical thinking',
    'Learning_Strategies': 'Learning strategies',
    'Monitoring': 'Monitoring',
    'Active_Listening': 'Active listening',
    'Mathematics': 'Mathematics',
    'Programming': 'Programming',
    'Reading_Comprehension': 'Reading comprehension',
    'Science': 'Science',
    'Speaking': 'Speaking',
    'Writing': 'Writing',
} %}
{% for col, label in skills.items() %}
select
    "Occupation"                                            as occupation_name,
    try_cast("Job Zone" as integer)                         as job_zone,
    '{{ label }}'                                           as skill,
    {{ clean_skill_value('"' ~ col ~ '_Importance"') }}     as importance,
    {{ clean_skill_value('"' ~ col ~ '_Level"') }}          as skill_level
from read_parquet('data/raw/onet_skills/raw.parquet')
{% if not loop.last %}union all{% endif %}
{% endfor %}
