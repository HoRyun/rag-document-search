-- 데이터베이스 인코딩 설정
ALTER DATABASE ragdb SET client_encoding TO 'UTF8';

-- pgvector 확장 추가
CREATE EXTENSION IF NOT EXISTS vector;

-- 문서 청크 테이블에 벡터 인덱스 추가
-- 테이블이 이미 생성된 후 이 스크립트를 실행할 수 있도록 조건부 실행
DO $$
BEGIN
    -- embedding 컬럼이 없는 경우에만 추가
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='document_chunks' 
        AND column_name='embedding_vector'
    ) THEN
        -- SQLAlchemy ARRAY 타입과 함께 사용할 embedding 컬럼은 유지
        -- pgvector 검색을 위한 vector 타입 컬럼 추가
        ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
        
        -- 인덱스 추가
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);
    END IF;
END
$$;

