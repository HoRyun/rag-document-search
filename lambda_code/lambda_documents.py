import json
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy.orm import Session

# 로깅 설정
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 커스텀 모듈 import
from db.database import get_db
from db.models import User, Document, DocumentChunk
from db.schemas import (
    DocumentCreate, DocumentResponse, DocumentUpdate,
    DocumentSearchRequest, DocumentSearchResponse
)
from fast_api.security import get_current_user
from services.document_service import DocumentService
from services.vector_service import VectorService

# FastAPI 앱 생성
app = FastAPI(
    title="AI Document API - Documents",
    description="Document management service for AI Document Management System",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "healthy", "service": "documents", "timestamp": datetime.utcnow()}


@app.get("/fast_api/documents", response_model=List[DocumentResponse])
def get_documents(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """사용자 문서 목록 조회"""
    try:
        document_service = DocumentService(db)
        documents = document_service.get_user_documents(
            user_id=current_user.id,
            skip=skip,
            limit=limit
        )
        logger.info(f"Retrieved {len(documents)} documents for user: {current_user.username}")
        return documents
    except Exception as e:
        logger.error(f"Document retrieval error: {e}")
        raise HTTPException(status_code=500, detail="문서 조회 중 오류가 발생했습니다.")


# 전역 예외 핸들러
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다.")

# Mangum 어댑터
mangum_adapter = Mangum(app, lifespan="off")

def lambda_handler(event, context):
    """Lambda 함수 핸들러"""
    try:
        return mangum_adapter(event, context)
    except Exception as e:
        logger.error(f"Lambda handler error: {e}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"})
        }

handler = lambda_handler
