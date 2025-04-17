from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

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
from io import BytesIO
from dotenv import load_dotenv
load_dotenv()


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

# 디렉토리 구조를 위한 Pydantic 모델
class DirectoryItem(BaseModel):
    id: str
    name: str
    path: str

class DirectoryList(BaseModel):
    directories: List[DirectoryItem]

# 임시 디렉토리 저장소 (실제로는 DB에 저장해야 함)
directory_storage = {
    "home": {
        "id": "home",
        "name": "Home",
        "path": "/"
    }
}

@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    """문서 목록 조회 엔드포인트"""
    try:
        documents = get_all_documents(db)
        return {"documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "s3_url": f"https://{S3_BUCKET_NAME}.s3.{AWS_DEFAULT_REGION}.amazonaws.com/{doc.s3_key}",  # URL 동적 생성
                "uploaded_at": doc.upload_time.isoformat()
            } for doc in documents
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # 1. 필수 필드 검증
        if not file.filename:
            raise ValueError("파일 이름이 없습니다.")
        if not current_user.username:
            raise ValueError("사용자 이름이 없습니다.")
        

        # 2. S3 업로드 (BytesIO 없이 UploadFile.file 직접 사용)
        s3_key = f"uploads/{current_user.username}/{file.filename}"
        s3_client.upload_fileobj(
            Fileobj=file.file,
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            ExtraArgs={'ContentType': file.content_type}
        )
        
        # 3. DB 저장 및 문서 처리
        code = await process_document(
            file=file,
            user_id=current_user.id,
            db=db,
            s3_key=s3_key
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


@router.get("/directories")
async def get_directories(
    current_user: User = Depends(get_current_user)
):
    """디렉토리 구조 가져오기 엔드포인트"""
    try:
        # 실제 구현에서는 DB에서 디렉토리 구조 가져오기
        directories = list(directory_storage.values())
        return {"directories": directories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching directories: {str(e)}")

@router.post("/sync-directories")
async def sync_directories(
    directory_list: DirectoryList,
    current_user: User = Depends(get_current_user)
):
    """디렉토리 구조를 서버와 동기화하는 엔드포인트"""
    try:
        # 실제 구현에서는 DB에 디렉토리 구조 저장
        for directory in directory_list.directories:
            directory_storage[directory.id] = {
                "id": directory.id,
                "name": directory.name,
                "path": directory.path
            }
        
        return {"message": "Directories synchronized successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing directories: {str(e)}")

@router.post("/create-directory")
async def create_directory(
    name: str = Form(...),
    path: str = Form("/"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새 폴더 생성 엔드포인트"""
    try:
        # 폴더 이름으로 고유 ID 생성
        import uuid
        dir_id = str(uuid.uuid4())
        
        # 새 경로 생성
        new_path = path
        if not new_path.endswith("/"):
            new_path += "/"
        new_path += name
        
        # 실제 구현에서는 DB에 폴더 정보 저장
        # 여기서는 임시 디렉토리 저장소에 저장
        directory_storage[dir_id] = {
            "id": dir_id,
            "name": name,
            "path": new_path
        }
        
        return {
            "id": dir_id,
            "name": name,
            "path": new_path,
            "message": "Directory created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating directory: {str(e)}")

@router.post("/query")
async def query_document(query: str = Form(...)):
    """문서 질의응답 엔드포인트"""
    answer = process_query(query)
    return {"answer": answer} 
