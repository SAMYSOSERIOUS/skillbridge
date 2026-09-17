.PHONY: setup ingest build test app demo docker lint

PY := python3
VENV := .venv
BIN := $(VENV)/bin

setup:
	$(PY) -m venv $(VENV)
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -e ".[dev]"

ingest:
	$(BIN)/python -m skillbridge.ingest.run

build:
	@echo "M1+: dbt build + precompute (not yet implemented in M0)"

lint:
	$(BIN)/ruff check python tests
	$(BIN)/ruff format --check python tests

test: lint
	$(BIN)/pytest -q

app:
	SKILLBRIDGE_DATA=data/sample $(BIN)/uvicorn skillbridge.api.main:app --host 0.0.0.0 --port 8000

demo:
	SKILLBRIDGE_DATA=data/sample $(BIN)/uvicorn skillbridge.api.main:app --host 0.0.0.0 --port 8000

docker:
	docker build -t skillbridge .
	docker run --rm -p 8000:8000 skillbridge
