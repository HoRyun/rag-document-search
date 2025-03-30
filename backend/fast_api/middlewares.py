"""FastAPI 미들웨어 모듈"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

def setup_middlewares(app: FastAPI):
    """애플리케이션 미들웨어 설정"""
    # CORS 설정
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    ) 