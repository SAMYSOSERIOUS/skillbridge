.PHONY: setup ingest build test app demo docker lint quality

PY := python3
VENV := .venv
BIN := $(VENV)/bin

setup:
	$(PY) -m venv $(VENV)
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -e ".[dev,data]"

# Download the pinned real source files (GitHub only; idempotent)
ingest:
	$(BIN)/python -m skillbridge.ingest.run

# Full pipeline: ingest -> normalize -> dbt build+test -> precompute -> report
build:
	$(BIN)/python flows/pipeline.py

quality:
	$(BIN)/python -m skillbridge.quality

lint:
	$(BIN)/ruff check python tests flows
	$(BIN)/ruff format --check python tests flows

test: lint
	$(BIN)/pytest -q

# Real data (needs `make build` once first)
app:
	$(BIN)/uvicorn skillbridge.api.main:app --host 0.0.0.0 --port 8000

# Synthetic 5-occupation fixture - zero downloads (CI uses this)
demo:
	SKILLBRIDGE_DATA=data/sample $(BIN)/uvicorn skillbridge.api.main:app --host 0.0.0.0 --port 8000

docker:
	docker build -t skillbridge .
	docker run --rm -p 8000:8000 skillbridge
