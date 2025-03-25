from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from schemas.schemas import UserResponse
from models.models import User
from core.security import get_current_user

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회 엔드포인트"""
    return current_user 