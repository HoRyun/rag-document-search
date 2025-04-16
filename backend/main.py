from contextlib import asynccontextmanager
from fastapi import FastAPI
import os

# 추적을 위한 .env 설정 불러오기
from dotenv import load_dotenv
load_dotenv()

# LangSmith 추적 활성화
from langchain_teddynote import logging

# 프로젝트 이름을 입력합니다.
logging.langsmith("25-1_RAG_Project")

from db.database import init_db
from fast_api.router import api_router
from fast_api.middlewares import setup_middlewares
from config.settings import UPLOAD_DIR
from rag.embeddings import manually_create_vector_extension

# 테이블 생성
# Base.metadata.create_all(bind=engine)

# 애플리케이션 시작 시 DB 초기화
@asynccontextmanager
async def lifespan(app: FastAPI):
    from db.database import engine  # 기존 엔진을 임포트
    init_db()
    
    # pgvector 익스텐션 생성
    manually_create_vector_extension(engine)
    yield


# FastAPI 앱 생성
app = FastAPI(title="RAG Document Search API", lifespan=lifespan)



# 미들웨어 설정
setup_middlewares(app)

# 업로드 디렉토리 확인
os.makedirs(UPLOAD_DIR, exist_ok=True)

# API 라우터 포함
app.include_router(api_router, prefix="/fast_api")



# 기본 경로
@app.get("/")
def read_root():
    return {"message": "Welcome to RAG Document Search API"}

# 헬스체크 엔드포인트
@app.get("/health")
def health_check():
    return {"status": "healthy"}
