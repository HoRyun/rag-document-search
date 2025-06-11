from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from db.models import User
from db.schemas import UserCreate
from fast_api.security import get_password_hash

def get_user_by_username(db: Session, username: str):
    """사용자명으로 사용자 조회"""
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str):
    """이메일로 사용자 조회"""
    return db.query(User).filter(User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    """사용자 목록 조회"""
    return db.query(User).offset(skip).limit(limit).all()

def create_user(db: Session, user: UserCreate):
    """사용자 생성"""
    # 이메일 중복 확인
    db_user = get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="이미 사용중인 이메일입니다.")
    
    # 사용자명 중복 확인
    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="이미 사용중인 사용자명입니다.")
    
    # 비밀번호 해싱
    hashed_password = get_password_hash(user.password)

    # 새로운 사용자 모델 생성
    db_user = User(
        email=user.email, 
        username=user.username,
        password_hash=hashed_password
    )
    
    # DB에 저장
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user 