import json
import logging
import os
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy.orm import Session
from sqlalchemy import text

# 로깅 설정
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 커스텀 모듈 import
from db.database import get_db
from db.models import User
from fast_api.security import get_current_user

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

@app.get("/")
def root():
    """루트 엔드포인트"""
    return {"message": "AI Document API - Documents service", "status": "healthy"}

@app.get("/health")
def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "healthy", "service": "documents", "timestamp": datetime.utcnow()}

@app.get("/fast_api/documents")
def list_items(
    path: str = Query("/", description="현재 경로"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """지정된 경로의 파일 및 폴더 목록을 반환"""
    from db import crud
    
    try:
        filtered_items = []
        user_id = current_user.id

        # 루트 디렉토리가 존재하지 않으면 생성
        if not crud.get_directory_by_id(db, "root"):
            crud.create_directory(db, "root", "/", True, None, datetime.now())

        selected_path = path

        # 커넥션 풀에서 직접 연결 가져오기
        with db.connection() as connection:
            # 파일 목록 쿼리
            file_query = text("""
                SELECT id, name, 'file' as type, path 
                FROM directories 
                WHERE path LIKE :selected_path || '/%' 
                AND path NOT LIKE :selected_path || '/%/%' 
                AND is_directory = FALSE
                AND owner_id = :user_id
            """)
            file_result = connection.execute(file_query, {"selected_path": selected_path, "user_id": user_id}).mappings().fetchall()
            
            # 디렉토리 목록 쿼리
            dir_query = text("""
                SELECT id, name, 'folder' as type, path 
                FROM directories 
                WHERE path LIKE :selected_path || '/%' 
                AND path NOT LIKE :selected_path || '/%/%' 
                AND is_directory = TRUE
                AND id <> 'root'
                AND owner_id = :user_id
            """)
            dir_result = connection.execute(dir_query, {"selected_path": selected_path, "user_id": user_id}).mappings().fetchall()

        # 가져온 정보를 filtered_items에 추가
        filtered_items.extend([dict(item) for item in file_result])
        filtered_items.extend([dict(item) for item in dir_result])
        
        logger.info(f"Retrieved {len(filtered_items)} items for user: {current_user.username} at path: {path}")
        return {"items": filtered_items}
        
    except Exception as e:
        logger.error(f"Error listing items: {e}")
        raise HTTPException(status_code=500, detail="파일 목록 조회 중 오류가 발생했습니다.")

@app.get("/fast_api/documents/structure")
def get_filesystem_structure(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """전체 파일 시스템 구조 반환"""
    from db import crud
    
    try:
        user_id = current_user.id

        # 루트 디렉토리가 존재하지 않으면 생성
        if not crud.get_directory_by_id(db, "root"):
            crud.create_directory(db, "root", "/", True, None, datetime.now())

        # 디렉토리만 필터링
        directories = crud.get_only_directory(db, user_id)

        # 최상위 디렉토리 이름(root) 찾기
        root = next((d['name'] for d in directories if d['parent_id'] == "root"), None)
        if not root:
            logger.warning(f"No root directory found for user: {current_user.username}")

        # 새 리스트에 수정된 객체 생성
        your_result = []
        for d in directories:
            # 루트 디렉토리는 제외
            if d['id'] == "root":
                continue
            your_result.append({
                'id': d['id'],
                'name': d['name'],
                'path': d['path']
            })
        
        directories = your_result

        logger.info(f"Retrieved {len(directories)} directories for user: {current_user.username}")
        return {"directories": directories}
        
    except Exception as e:
        logger.error(f"Error fetching filesystem structure: {e}")
        raise HTTPException(status_code=500, detail="파일 시스템 구조 조회 중 오류가 발생했습니다.")

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
