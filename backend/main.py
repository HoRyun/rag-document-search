from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from db.database import engine
from models.models import Base
from api.v1.router import api_router
from config.settings import UPLOAD_DIR

# 테이블 생성
Base.metadata.create_all(bind=engine)

# FastAPI 앱 생성
app = FastAPI(title="RAG Document Search API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 업로드 디렉토리 확인
os.makedirs(UPLOAD_DIR, exist_ok=True)

# API 라우터 포함
app.include_router(api_router, prefix="/api/v1")

# 루트 엔드포인트
@app.get("/")
def read_root():
    return {"message": "RAG Document Search API"}

# 헬스체크 엔드포인트
@app.get("/health")
def health_check():
    return {"status": "healthy"}
