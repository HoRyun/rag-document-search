"""FastAPI 미들웨어 모듈"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from starlette.middleware.sessions import SessionMiddleware

def setup_middlewares(app: FastAPI):
    """애플리케이션 미들웨어 설정"""
    # CORS 설정
    origins = [
        "http://rag-document-management.s3-website.ap-northeast-2.amazonaws.com",
        "http://localhost:3000",  # 로컬 개발 환경
        # 필요한 경우 추가 도메인 허용
    ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )