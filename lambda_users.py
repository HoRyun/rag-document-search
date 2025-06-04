import json
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy.orm import Session
import sys
import os

# Lambda 환경에서 모듈 경로 설정
if os.environ.get('AWS_EXECUTION_ENV') is not None:
    sys.path.append('/opt/python')

from db.database import get_db
from db.models import User
from db.schemas import UserResponse
from fast_api.security import get_current_user

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/fast_api/users", response_model=list[UserResponse])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """사용자 목록 조회 엔드포인트"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다.")
        
    users = db.query(User).offset(skip).limit(limit).all()
    return users

# Lambda 핸들러
handler = Mangum(app)