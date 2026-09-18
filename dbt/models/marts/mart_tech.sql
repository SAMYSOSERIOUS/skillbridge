select soc_code, technology, hot
from {{ ref('fct_tech') }}
