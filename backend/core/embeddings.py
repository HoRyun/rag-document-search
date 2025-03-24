from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.llms import Ollama
from langchain_postgres import PGVector
import re
import time
from sqlalchemy import create_engine, text

from config.settings import OLLAMA_HOST, OLLAMA_PORT, DATABASE_URL

def get_embeddings():
    """임베딩 모델 함수"""
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def get_llm():
    """LLM 모델 함수"""
    return Ollama(base_url=f"http://{OLLAMA_HOST}:{OLLAMA_PORT}", model="llama2")

def manually_create_vector_extension():
    """pgvector 확장을 수동으로 생성합니다"""
    try:
        # 클라이언트 인코딩 옵션 추가
        modified_url = DATABASE_URL
        if 'postgresql' in DATABASE_URL:
            if '?' in DATABASE_URL:
                modified_url = f"{DATABASE_URL}&client_encoding=utf8"
            else:
                modified_url = f"{DATABASE_URL}?client_encoding=utf8"
                
        engine = create_engine(modified_url)
        with engine.connect() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            connection.commit()
        return True
    except Exception as e:
        print(f"수동 벡터 확장 생성 오류: {str(e)}")
        return False

def get_vector_store():
    """벡터 스토어 함수 (PostgreSQL 사용)"""
    embeddings = get_embeddings()
    
    # 클라이언트 인코딩 옵션 추가
    modified_url = DATABASE_URL
    if 'postgresql' in DATABASE_URL:
        # 기존 URL에 client_encoding 매개변수 추가
        if '?' in DATABASE_URL:
            modified_url = f"{DATABASE_URL}&client_encoding=utf8"
        else:
            modified_url = f"{DATABASE_URL}?client_encoding=utf8"
    
    # 재시도 로직
    retries = 3
    for attempt in range(retries):
        try:
            vector_store = PGVector(
                collection_name="document_chunks",
                connection=modified_url,
                embeddings=embeddings,
                use_jsonb=True,
            )
            return vector_store
        except Exception as e:
            print(f"PGVector 생성 오류 (시도 {attempt+1}/{retries}): {str(e)}")
            
            # 마지막 시도가 아니면 재시도
            if attempt < retries - 1:
                # 벡터 확장 수동 생성 시도
                manually_create_vector_extension()
                time.sleep(2)  # 잠시 대기
            else:
                raise  # 모든 시도 실패 시 예외 발생
    
    return None  # 이 코드는 실행되지 않지만 명시적으로 추가 