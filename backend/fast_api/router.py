from fastapi import APIRouter

from fast_api.endpoints.auth import router as auth_router
from fast_api.endpoints.documents import router as documents_router
from fast_api.endpoints.users import router as users_router

api_router = APIRouter()

# 인증 관련 라우터
api_router.include_router(auth_router, prefix="/auth", tags=["인증"])

# 문서 관련 라우터
api_router.include_router(documents_router, prefix="/documents", tags=["문서"])

# 사용자 관련 라우터
api_router.include_router(users_router, prefix="/users", tags=["사용자"]) 