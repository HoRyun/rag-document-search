# --- 빌드 스테이지 ---
FROM python:3.11-slim AS builder

WORKDIR /app
    
# 빌드 도구 및 필요한 시스템 패키지 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    libpq-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 패키지 설치
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "pydantic[email]"

# --- 최종 이미지 ---
FROM python:3.11-slim

# 런타임 라이브러리 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 로그 설정
RUN mkdir -p /var/log/app
ENV LOG_PATH=/var/log/app/app.log
COPY logging.conf /app/logging.conf
VOLUME /var/log/app

# 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "pydantic[email]" && \
    pip install --no-cache-dir uvicorn

# 애플리케이션 코드 복사
COPY . .

# 포트 설정
EXPOSE 8000

# 서버 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "logging.conf", "--reload"]
    