FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
COPY python ./python
RUN pip install --no-cache-dir .

COPY web ./web
COPY data/sample ./data/sample
COPY config.yaml ./

ENV SKILLBRIDGE_DATA=data/sample
EXPOSE 8000

CMD ["uvicorn", "skillbridge.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
