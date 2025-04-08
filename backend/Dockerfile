# --- 1단계: 빌드 전용 스테이지 ---
FROM python:3.11-slim AS builder

# 작업 디렉토리를 /app으로 유지
WORKDIR /app

# 빌드 도구 및 PostgreSQL 헤더 설치 (일시적 사용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    libpq-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 패키지 목록 복사
COPY requirements.txt .

# 로그 디렉토리 생성
RUN mkdir -p /var/log/app
ENV LOG_PATH=/var/log/app/app.log

# 로그 볼륨 마운트 (docker-compose.yml)
VOLUME /var/log/app

# pip 업그레이드 및 패키지 설치
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "pydantic[email]"


# --- 2단계: 최종 실행 이미지 ---
FROM python:3.11-slim

# 필요한 런타임 라이브러리 설치 (git과 curl 유지)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 동일하게 유지
WORKDIR /app

# 패키지 목록 복사 및 필요한 패키지 직접 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "pydantic[email]" && \
    pip install --no-cache-dir uvicorn && \
    which uvicorn && \
    ls -la /usr/local/bin/

# 애플리케이션 소스 코드 복사
COPY . .

# 컨테이너에서 노출할 포트 명시
EXPOSE 8000

# 컨테이너 실행 시 uvicorn 서버 실행 (개발용 reload 포함)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "logging.conf", "--reload"]
