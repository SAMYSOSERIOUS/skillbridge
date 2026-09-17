# Stage 1 - build the real dataset inside the image.
# Downloads come only from raw.githubusercontent.com (pinned commits), so
# this works on Hugging Face Spaces, Render, Fly.io, and locally alike.
FROM python:3.11-slim AS data

WORKDIR /app
COPY pyproject.toml ./
COPY python ./python
RUN pip install --no-cache-dir ".[data]"

COPY dbt ./dbt
COPY flows ./flows
COPY config.yaml ./
# ingest -> normalize -> dbt build+test -> precompute -> quality report
RUN python flows/pipeline.py

# Stage 2 - slim runtime (no dbt, no sklearn, no raw data)
FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml ./
COPY python ./python
RUN pip install --no-cache-dir .

COPY web ./web
COPY config.yaml ./
COPY data/sample ./data/sample
COPY --from=data /app/data/artifacts ./data/artifacts
COPY --from=data /app/data/data_quality.md ./data/data_quality.md

EXPOSE 8000

CMD ["uvicorn", "skillbridge.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
