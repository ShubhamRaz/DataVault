# DataVault ml-service — PyTorch (CPU) federated learning service
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DATA_ROOT=/app/data/participants \
    MODELS_DIR=/app/data/models

WORKDIR /app

# CPU-only torch wheel keeps the image small (spec: Python 3.11, CPU only)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY tests ./tests

# generate the 9 synthetic participant datasets deterministically at build time
RUN python -m app.datasets.generators > /dev/null

EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=5s --retries=10 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8001/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
