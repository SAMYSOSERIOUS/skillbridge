select soc_code, technology, hot, generic
from {{ ref('fct_tech') }}
order by soc_code, hot desc, generic asc, technology
