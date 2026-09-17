FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
COPY python ./python
RUN pip install --no-cache-dir .

COPY web ./web
COPY config.yaml ./
# data/ arrives filtered by .dockerignore: sample fixture always, real
# precomputed artifacts when present (run `make build` before `make docker`);
# raw zone and the DuckDB file stay out of the image.
COPY data ./data

EXPOSE 8000

CMD ["uvicorn", "skillbridge.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
