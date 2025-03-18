FROM python:3.11-slim

WORKDIR /app

# 빌드 도구 및 필수 라이브러리 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# pip 업그레이드
RUN pip install --upgrade pip

# 의존성 파일만 먼저 복사하여 캐싱 활용
COPY requirements.txt .

# 명시적으로 따옴표 사용하여 extras 처리
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "pydantic[email]"
# 애플리케이션 코드 복사
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
