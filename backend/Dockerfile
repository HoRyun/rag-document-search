FROM python:3.10-slim

WORKDIR /app

# 빌드 도구 및 필수 라이브러리 설치
RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# pip 업그레이드 (권장)
RUN pip install --upgrade pip

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
