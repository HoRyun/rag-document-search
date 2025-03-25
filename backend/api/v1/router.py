from fastapi import APIRouter

from api.v1.endpoints import auth, documents, users

api_router = APIRouter()

# 인증 관련 라우터
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# 문서 관련 라우터
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])

# 사용자 관련 라우터
api_router.include_router(users.router, prefix="/users", tags=["users"]) 