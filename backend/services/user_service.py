from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.models import User
from schemas.schemas import UserCreate
from core.security import get_password_hash

def create_user(db: Session, user: UserCreate):
    """사용자 생성"""
    # 사용자 이름 중복 확인
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # 이메일 중복 확인
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 비밀번호 해싱 및 사용자 생성
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, email=user.email, password_hash=hashed_password)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user 