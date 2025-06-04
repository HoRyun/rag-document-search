import json
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy.orm import Session
from datetime import timedelta
import logging
from typing import Annotated
import sys
import os

# Lambda 환경에서 모듈 경로 설정
if os.environ.get('AWS_EXECUTION_ENV') is not None:
    sys.path.append('/opt/python')

from db.database import get_db
from db.models import User
from db.schemas import UserCreate, UserResponse, Token
from db.user_service import create_user
from config.settings import ACCESS_TOKEN_EXPIRE_MINUTES
from fast_api.security import authenticate_user, create_access_token, get_current_user

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/fast_api/auth/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """회원가입 엔드포인트"""
    try:
        db_user = create_user(db, user)
        return db_user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fast_api/auth/token", response_model=Token)
def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    """로그인 및 토큰 발급 엔드포인트"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/fast_api/auth/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """현재 사용자 정보 조회 엔드포인트"""
    return current_user

# Lambda 핸들러
handler = Mangum(app)