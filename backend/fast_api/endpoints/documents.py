from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import boto3
from botocore.exceptions import ClientError
from db.database import get_db
from db.models import User
from fast_api.security import get_current_user
from rag.document_service import get_all_documents, process_document, process_query
from config.settings import AWS_SECRET_ACCESS_KEY,S3_BUCKET_NAME,AWS_ACCESS_KEY_ID,AWS_DEFAULT_REGION  # 설정 임포트
import os
from db.models import Document
from datetime import datetime
import logging


# 로거 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
logger.addHandler(handler)

# S3 클라이언트 초기화 (설정 사용)
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_DEFAULT_REGION
)
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
if not S3_BUCKET_NAME:
    raise ValueError("S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.")

router = APIRouter()

@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    """문서 목록 조회 엔드포인트"""
    try:
        documents = get_all_documents(db)
        return {"documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "uploaded_at": doc.upload_time.isoformat()
            } for doc in documents
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)  # 현재 사용자 정보 가져오기
):
    try:
        # 1. 필수 필드 검증
        if not file.filename:
            raise ValueError("파일 이름이 없습니다.")
        if not current_user.username:
            raise ValueError("사용자 이름이 없습니다.")

        # 2. S3 키 생성 (사용자 이름 기반)
        s3_key = f"uploads/{current_user.username}/{file.filename}"

        # 3. 파일 업로드
        s3_client.upload_fileobj(
            Fileobj=file.file,
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            ExtraArgs={'ContentType': file.content_type}
        )

        return JSONResponse(
            content={
                "code": 200,
                "message": "파일 업로드 성공",
                "results": [{
                    "filename": file.filename,
                    "s3_url": f"https://{S3_BUCKET_NAME}.s3.{os.getenv('AWS_DEFAULT_REGION')}.amazonaws.com/{s3_key}"
                }]
            }
        )
        
    except Exception as e:
        logger.error(f"파일 업로드 실패: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "code": 500,
                "message": "파일 업로드 실패",
                "error": str(e)
            }
        )
    
@router.post("/query")
async def query_document(query: str = Form(...)):
    """문서 질의응답 엔드포인트"""
    answer = process_query(query)
    return {"answer": answer} 
