# PostgreSQL 14 이미지를 기반으로 함
FROM postgres:14

# pgvector 확장을 위한 의존성 설치
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        postgresql-server-dev-14 \
        git \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pgvector 확장 설치
RUN git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && cd .. \
    && rm -rf pgvector

# 초기화 스크립트 복사 (필요한 경우)
#COPY postgres/init.sql /docker-entrypoint-initdb.d/

# 환경 변수 설정
ENV POSTGRES_DB=ragdb
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres

# 포트 노출
EXPOSE 5432
