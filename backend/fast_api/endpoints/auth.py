from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import logging
from typing import Annotated

from db.database import get_db
from db.models import User
from db.schemas import UserCreate, UserResponse, Token
from db.user_service import create_user
from config.settings import ACCESS_TOKEN_EXPIRE_MINUTES
from fast_api.security import (
    authenticate_user,
    create_access_token,
    get_current_user
)

router = APIRouter()

# 로깅 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """회원가입 엔드포인트"""
    try:
        db_user = create_user(db, user)
        return db_user
    except HTTPException as e:
        # 이미 잡은 예외는 그대로 다시 발생
        raise e
    except Exception as e:
        logging.error(f"회원가입 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="회원가입 중 오류가 발생했습니다."
        )

@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    """로그인 및 토큰 발급 엔드포인트"""
    # OAuth2PasswordRequestForm는 username 필드를 사용하지만, 이 애플리케이션에서는 이메일로 로그인합니다
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """현재 사용자 정보 조회 엔드포인트"""
    return current_user 