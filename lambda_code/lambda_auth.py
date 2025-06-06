import json
import logging
import os
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy.orm import Session

# 로깅 설정
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 커스텀 모듈 import
from db.database import get_db
from db.models import User
from db.schemas import UserCreate, UserResponse, Token
from db.user_service import create_user
from fast_api.security import authenticate_user, create_access_token, get_current_user
from config.settings import ACCESS_TOKEN_EXPIRE_MINUTES

# FastAPI 앱 생성
app = FastAPI(
    title="AI Document API - Authentication",
    description="Authentication service for AI Document Management System",
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
    return {"status": "healthy", "service": "auth", "timestamp": datetime.utcnow()}

@app.post("/auth/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """회원가입 엔드포인트"""
    try:
        logger.info(f"Registration attempt for user: {user.username}")
        db_user = create_user(db, user)
        logger.info(f"User registered successfully: {user.username}")
        return db_user
    except ValueError as e:
        logger.warning(f"Registration validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="회원가입 처리 중 오류가 발생했습니다.")

@app.post("/auth/token", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], 
    db: Session = Depends(get_db)
):
    """로그인 및 토큰 발급 엔드포인트"""
    try:
        logger.info(f"Login attempt for user: {form_data.username}")
        user = authenticate_user(db, form_data.username, form_data.password)
        if not user:
            logger.warning(f"Failed login attempt for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="아이디 또는 비밀번호가 올바르지 않습니다.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, 
            expires_delta=access_token_expires
        )
        
        logger.info(f"Successful login for user: {form_data.username}")
        return {"access_token": access_token, "token_type": "bearer"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="로그인 처리 중 오류가 발생했습니다.")

@app.get("/auth/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """현재 사용자 정보 조회 엔드포인트"""
    try:
        logger.info(f"User info request for: {current_user.username}")
        return current_user
    except Exception as e:
        logger.error(f"User info retrieval error: {e}")
        raise HTTPException(status_code=500, detail="사용자 정보 조회 중 오류가 발생했습니다.")

@app.post("/auth/refresh", response_model=Token)
def refresh_token(current_user: User = Depends(get_current_user)):
    """토큰 갱신 엔드포인트"""
    try:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": current_user.username}, 
            expires_delta=access_token_expires
        )
        logger.info(f"Token refreshed for user: {current_user.username}")
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(status_code=500, detail="토큰 갱신 중 오류가 발생했습니다.")

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
