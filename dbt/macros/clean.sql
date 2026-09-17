{% macro clean_skill_value(col) %}
    case
        when {{ col }} = 'Not relevant' then 0.0
        when {{ col }} = 'Not available' or {{ col }} is null or {{ col }} = '' then null
        else try_cast({{ col }} as double)
    end
{% endmacro %}

{% macro clean_oews_number(col) %}
    case
        when {{ col }} in ('#', '*', '**') or {{ col }} is null or {{ col }} = '' then null
        else try_cast(replace({{ col }}, ',', '') as double)
    end
{% endmacro %}
