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
    
    # 빌드 인자 정의 (GitHub Actions에서 전달)
    ARG RDS_USER
    ARG RDS_PASSWORD
    ARG RDS_ENDPOINT
    ARG RDS_DB_NAME
    ARG OPENAI_API_KEY
    ARG LANGCHAIN_API_KEY
    ARG LANGCHAIN_PROJECT
    ARG LANGCHAIN_ENDPOINT
    ARG LANGCHAIN_TRACING_V2
    ARG S3_BUCKET_NAME
    
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
    
    RUN pip install --upgrade pip setuptools wheel \
        && pip install --no-cache-dir -r requirements.txt \
        && pip install --no-cache-dir "pydantic[email]" \
        && pip install --no-cache-dir uvicorn python-dotenv \
        && which uvicorn \
        && ls -la /usr/local/bin/
    
    # 환경 변수 설정
    ENV RDS_USER=${RDS_USER} \
        RDS_PASSWORD=${RDS_PASSWORD} \
        RDS_ENDPOINT=${RDS_ENDPOINT} \
        RDS_DB_NAME=${RDS_DB_NAME} \
        OPENAI_API_KEY=${OPENAI_API_KEY} \
        LANGCHAIN_API_KEY=${LANGCHAIN_API_KEY} \
        LANGCHAIN_PROJECT=${LANGCHAIN_PROJECT} \
        LANGCHAIN_ENDPOINT=${LANGCHAIN_ENDPOINT} \
        LANGCHAIN_TRACING_V2=${LANGCHAIN_TRACING_V2} \
        S3_BUCKET_NAME=${S3_BUCKET_NAME} \
        DATABASE_URL=postgresql+psycopg://${RDS_USER}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}
    
    # 애플리케이션 코드 복사
    COPY . .
    
    # 포트 설정
    EXPOSE 8000
    
    # 서버 실행
    CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "logging.conf", "--reload"]
    