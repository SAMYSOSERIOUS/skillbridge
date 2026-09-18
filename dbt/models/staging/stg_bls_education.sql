-- BLS EP education/training assignments (Fix 2). May be EMPTY when the
-- optional download was unavailable - every consumer handles that.
select
    soc_code,
    typical_education,
    work_experience,
    on_the_job_training
from read_parquet('data/raw/onet_full/bls_education.parquet')
