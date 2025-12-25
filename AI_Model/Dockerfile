FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.prod.txt .

RUN pip install --upgrade pip && \
    pip install \
    --no-cache-dir \
    --default-timeout=1000 \
    --retries 10 \
    -r requirements.prod.txt

COPY main.py .
COPY rainfall_model.keras .
COPY scaler.gz .

ENV MODEL_PATH=/app/rainfall_model.keras
ENV SCALER_PATH=/app/scaler.gz
ENV PYTHONUNBUFFERED=1

EXPOSE 5001

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "main:app", "--bind", "0.0.0.0:5001"]
