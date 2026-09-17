-- Hard rule 2: suppressed OEWS cells are NULL, never 0.
select * from {{ ref('fct_wages') }} where wage_median = 0
