FROM python:3.11-slim

WORKDIR /app

# System libs needed by python-pptx / Pillow / lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# App code (results in /app/app/main.py)
COPY backend/ /app/

# Built React frontend — main.py serves it from ../../frontend/dist (= /frontend/dist)
COPY frontend/dist /frontend/dist

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
