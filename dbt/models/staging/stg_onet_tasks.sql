-- O*NET task statements, rolled up to 6-digit SOC. One row per SOC with
-- the concatenated task text (input to the task-content similarity term).
select
    substr("O*NET-SOC Code", 1, 7) as soc_code,
    string_agg("Task", ' ')        as task_text,
    count(*)                       as n_tasks
from read_parquet('data/raw/onet_tasks/raw.parquet')
where "Task" is not null and "O*NET-SOC Code" is not null
group by 1
