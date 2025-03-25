-- 데이터베이스 인코딩 설정
ALTER DATABASE ragdb SET client_encoding TO 'UTF8';

-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

