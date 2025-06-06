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

@app.post("/documents", response_model=DocumentResponse)
async def create_document(
    document: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """문서 생성 엔드포인트"""
    try:
        logger.info(f"Creating document '{document.title}' for user: {current_user.username}")
        
        document_service = DocumentService(db)
        vector_service = VectorService()
        
        # 문서 생성
        db_document = document_service.create_document(
            title=document.title,
            content=document.content,
            user_id=current_user.id
        )
        
        # 벡터 임베딩 생성 (비동기 처리)
        try:
            embedding = await vector_service.create_embedding(document.content)
            document_service.update_document_embedding(db_document.id, embedding)
            
            # 문서 청킹 및 벡터화
            chunks = vector_service.chunk_document(document.content)
            for i, chunk in enumerate(chunks):
                chunk_embedding = await vector_service.create_embedding(chunk)
                document_service.create_document_chunk(
                    document_id=db_document.id,
                    chunk_text=chunk,
                    chunk_index=i,
                    embedding=chunk_embedding
                )
        except Exception as e:
            logger.warning(f"Vector processing failed for document {db_document.id}: {e}")
        
        logger.info(f"Document created successfully: {db_document.id}")
        return db_document
        
    except Exception as e:
        logger.error(f"Document creation error: {e}")
        raise HTTPException(status_code=500, detail="문서 생성 중 오류가 발생했습니다.")

@app.get("/documents", response_model=List[DocumentResponse])
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

@app.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 문서 조회"""
    try:
        document_service = DocumentService(db)
        document = document_service.get_document(document_id, current_user.id)
        
        if not document:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        
        logger.info(f"Document {document_id} retrieved by user: {current_user.username}")
        return document
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document retrieval error: {e}")
        raise HTTPException(status_code=500, detail="문서 조회 중 오류가 발생했습니다.")

@app.put("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """문서 수정"""
    try:
        document_service = DocumentService(db)
        vector_service = VectorService()
        
        # 문서 소유권 확인
        existing_document = document_service.get_document(document_id, current_user.id)
        if not existing_document:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        
        # 문서 업데이트
        updated_document = document_service.update_document(
            document_id=document_id,
            title=document_update.title,
            content=document_update.content
        )
        
        # 내용이 변경된 경우 벡터 재생성
        if document_update.content and document_update.content != existing_document.content:
            try:
                embedding = await vector_service.create_embedding(document_update.content)
                document_service.update_document_embedding(document_id, embedding)
                
                # 기존 청크 삭제 후 재생성
                document_service.delete_document_chunks(document_id)
                chunks = vector_service.chunk_document(document_update.content)
                for i, chunk in enumerate(chunks):
                    chunk_embedding = await vector_service.create_embedding(chunk)
                    document_service.create_document_chunk(
                        document_id=document_id,
                        chunk_text=chunk,
                        chunk_index=i,
                        embedding=chunk_embedding
                    )
            except Exception as e:
                logger.warning(f"Vector update failed for document {document_id}: {e}")
        
        logger.info(f"Document {document_id} updated by user: {current_user.username}")
        return updated_document
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document update error: {e}")
        raise HTTPException(status_code=500, detail="문서 수정 중 오류가 발생했습니다.")

@app.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """문서 삭제"""
    try:
        document_service = DocumentService(db)
        
        # 문서 소유권 확인
        document = document_service.get_document(document_id, current_user.id)
        if not document:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        
        # 문서 및 관련 청크 삭제
        document_service.delete_document(document_id)
        
        logger.info(f"Document {document_id} deleted by user: {current_user.username}")
        return {"message": "문서가 성공적으로 삭제되었습니다."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document deletion error: {e}")
        raise HTTPException(status_code=500, detail="문서 삭제 중 오류가 발생했습니다.")

@app.post("/documents/search", response_model=DocumentSearchResponse)
async def search_documents(
    search_request: DocumentSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """벡터 유사도 기반 문서 검색"""
    try:
        vector_service = VectorService()
        document_service = DocumentService(db)
        
        # 검색 쿼리 벡터화
        query_embedding = await vector_service.create_embedding(search_request.query)
        
        # 유사도 검색 수행
        similar_chunks = document_service.search_similar_chunks(
            user_id=current_user.id,
            query_embedding=query_embedding,
            limit=search_request.limit or 10,
            similarity_threshold=search_request.similarity_threshold or 0.7
        )
        
        # 결과 포맷팅
        results = []
        for chunk, similarity in similar_chunks:
            document = document_service.get_document(chunk.document_id, current_user.id)
            if document:
                results.append({
                    "document_id": document.id,
                    "title": document.title,
                    "chunk_text": chunk.chunk_text,
                    "similarity_score": similarity,
                    "chunk_index": chunk.chunk_index
                })
        
        logger.info(f"Vector search completed for user {current_user.username}: {len(results)} results")
        return DocumentSearchResponse(
            query=search_request.query,
            results=results,
            total_results=len(results)
        )
        
    except Exception as e:
        logger.error(f"Document search error: {e}")
        raise HTTPException(status_code=500, detail="문서 검색 중 오류가 발생했습니다.")

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
