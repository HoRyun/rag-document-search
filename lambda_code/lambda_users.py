import json
import logging
import os
from datetime import datetime
from typing import List

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy.orm import Session

# 로깅 설정
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 커스텀 모듈 import
from db.database import get_db
from db.models import User
from db.schemas import UserResponse, UserUpdate, UserStatsResponse
from fast_api.security import get_current_user
from services.user_service import UserService

# FastAPI 앱 생성
app = FastAPI(
    title="AI Document API - Users",
    description="User management service for AI Document Management System",
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
    return {"status": "healthy", "service": "users", "timestamp": datetime.utcnow()}

@app.get("/users/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """현재 사용자 정보 조회"""
    try:
        logger.info(f"User info requested: {current_user.username}")
        return current_user
    except Exception as e:
        logger.error(f"User info retrieval error: {e}")
        raise HTTPException(status_code=500, detail="사용자 정보 조회 중 오류가 발생했습니다.")

# @app.put("/users/me", response_model=UserResponse)
# def update_current_user(
#     user_update: UserUpdate,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     """현재 사용자 정보 수정"""
#     try:
#         user_service = UserService(db)
        
#         # 이메일 중복 확인 (다른 사용자가 사용 중인지)
#         if user_update.email and user_update.email != current_user.email:
#             existing_user = user_service.get_user_by_email(user_update.email)
#             if existing_user and existing_user.id != current_user.id:
#                 raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
        
#         # 사용자 정보 업데이트
#         updated_user = user_service.update_user(
#             user_id=current_user.id,
#             email=user_update.email,
#             username=user_update.username
#         )
        
#         logger.info(f"User updated: {current_user.username}")
#         return updated_user
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"User update error: {e}")
#         raise HTTPException(status_code=500, detail="사용자 정보 수정 중 오류가 발생했습니다.")

# @app.get("/users/me/stats", response_model=UserStatsResponse)
# def get_user_stats(
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     """사용자 통계 정보 조회"""
#     try:
#         user_service = UserService(db)
#         stats = user_service.get_user_stats(current_user.id)
        
#         logger.info(f"User stats requested: {current_user.username}")
#         return UserStatsResponse(
#             total_documents=stats['total_documents'],
#             total_chunks=stats['total_chunks'],
#             account_created=current_user.created_at,
#             last_document_created=stats['last_document_created']
#         )
        
#     except Exception as e:
#         logger.error(f"User stats error: {e}")
#         raise HTTPException(status_code=500, detail="사용자 통계 조회 중 오류가 발생했습니다.")

# @app.delete("/users/me")
# def delete_current_user(
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     """현재 사용자 계정 삭제"""
#     try:
#         user_service = UserService(db)
        
#         # 사용자 및 관련 데이터 삭제
#         user_service.delete_user(current_user.id)
        
#         logger.info(f"User account deleted: {current_user.username}")
#         return {"message": "계정이 성공적으로 삭제되었습니다."}
        
#     except Exception as e:
#         logger.error(f"User deletion error: {e}")
#         raise HTTPException(status_code=500, detail="계정 삭제 중 오류가 발생했습니다.")

# 관리자 전용 엔드포인트들 (필요시 주석 해제)
# @app.get("/users", response_model=List[UserResponse])
# def get_all_users(
#     skip: int = 0,
#     limit: int = 100,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     """모든 사용자 조회 (관리자 전용)"""
#     if not current_user.is_admin:
#         raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다.")
#     
#     try:
#         user_service = UserService(db)
#         users = user_service.get_all_users(skip=skip, limit=limit)
#         return users
#     except Exception as e:
#         logger.error(f"Users retrieval error: {e}")
#         raise HTTPException(status_code=500, detail="사용자 목록 조회 중 오류가 발생했습니다.")

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
