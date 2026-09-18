-- Typical education / experience / training per occupation. May be EMPTY
-- when neither source was available - every consumer handles that.
-- education_source says which real source filled it: BLS Employment
-- Projections (preferred) or O*NET ETE modal categories (fallback,
-- derived from the same accepted O*NET zip).
select
    soc_code,
    typical_education,
    work_experience,
    on_the_job_training,
    education_source
from read_parquet('data/raw/onet_full/education.parquet')
