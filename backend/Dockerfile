FROM python:3.11-slim

WORKDIR /app

# 필수 시스템 라이브러리 설치 (통합 및 최적화)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    g++ \
    python3-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 환경 변수 설정
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# pip 업그레이드
RUN pip install --upgrade pip

# 요구사항 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 서버 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
