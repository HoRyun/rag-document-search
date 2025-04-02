from fastapi import FastAPI
import os

# 추적을 위한 .env 설정 불러오기
from dotenv import load_dotenv
load_dotenv()

# LangSmith 추적 활성화
from langchain_teddynote import logging

# 프로젝트 이름을 입력합니다.
logging.langsmith("25-1_RAG_Project")

from db.database import engine
from db.models import Base
from fast_api.router import api_router
from fast_api.middlewares import setup_middlewares
from config.settings import UPLOAD_DIR

# 테이블 생성
Base.metadata.create_all(bind=engine)

# FastAPI 앱 생성
app = FastAPI(title="RAG Document Search API")

# 미들웨어 설정
setup_middlewares(app)

# 업로드 디렉토리 확인
os.makedirs(UPLOAD_DIR, exist_ok=True)

# API 라우터 포함
app.include_router(api_router, prefix="/fast_api")

# 루트 엔드포인트
@app.get("/")
def read_root():
    return {"message": "RAG Document Search API"}

# 헬스체크 엔드포인트
@app.get("/health")
def health_check():
    return {"status": "healthy"}
