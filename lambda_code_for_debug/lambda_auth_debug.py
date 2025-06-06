import json
import logging
import sys
import os
from typing import Annotated
from datetime import timedelta

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lambda 환경에서 모든 레이어 경로 설정
if os.environ.get('AWS_EXECUTION_ENV') is not None:
    layer_paths = [
        '/opt/python',
        '/opt/python/lib/python3.9/site-packages',
        '/opt',
        '/opt/python/psycopg2',
        '/var/runtime',
        '/var/task'
    ]
    
    for path in layer_paths:
        if path not in sys.path and os.path.exists(path):
            sys.path.insert(0, path)
    
    logger.info("Lambda environment detected, added layer paths to sys.path")
    logger.info(f"Python path: {sys.path[:8]}")

# psycopg2 모듈 찾기 및 import (단순화)
def setup_psycopg2():
    """psycopg2 설정을 위한 함수"""
    try:
        import psycopg2
        version = getattr(psycopg2, '__version__', 'available')
        logger.info(f"✓ psycopg2 imported successfully: {version}")
        return f"✓ {version}"
    except ImportError as e:
        logger.error(f"✗ Failed to import psycopg2: {e}")
        return f"Import failed: {e}"

postgresql_status = setup_psycopg2()

# 외부 의존성 import
try:
    from fastapi import FastAPI, Depends, HTTPException, status
    from fastapi.security import OAuth2PasswordRequestForm
    from fastapi.middleware.cors import CORSMiddleware
    from mangum import Mangum
    from sqlalchemy.orm import Session
    logger.info("✓ Successfully imported external dependencies")
except ImportError as e:
    logger.error(f"✗ Failed to import external dependencies: {e}")
    raise

# 커스텀 모듈 import
custom_modules = {}
try:
    from db.database import get_db
    from db.models import User
    from db.schemas import UserCreate, UserResponse, Token
    from db.user_service import create_user
    custom_modules['db'] = "✓ All db modules imported successfully"
    logger.info("✓ db modules imported successfully")
except ImportError as e:
    custom_modules['db'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import db modules: {e}")
    raise

try:
    from config.settings import ACCESS_TOKEN_EXPIRE_MINUTES
    custom_modules['config'] = "✓ Settings imported successfully"
    logger.info("✓ config.settings imported successfully")
except ImportError as e:
    custom_modules['config'] = f"Import failed: {e}, using default"
    logger.error(f"✗ Failed to import config.settings: {e}")
    ACCESS_TOKEN_EXPIRE_MINUTES = 30

try:
    from fast_api.security import authenticate_user, create_access_token, get_current_user
    custom_modules['fast_api'] = "✓ Security modules imported successfully"
    logger.info("✓ fast_api.security imported successfully")
except ImportError as e:
    custom_modules['fast_api'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import fast_api.security: {e}")
    raise

# FastAPI 앱 생성
app = FastAPI(
    title="AI Document API",
    description="Authentication API for AI Document Management",
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

@app.get("/")
def root():
    """헬스체크 엔드포인트"""
    return {
        "message": "AI Document API is running", 
        "status": "healthy",
        "python_path_count": len(sys.path),
        "lambda_env": bool(os.environ.get('AWS_EXECUTION_ENV')),
        "layers_status": {
            "dependencies": "✓ FastAPI, Mangum, SQLAlchemy loaded",
            "postgresql": postgresql_status,
            "custom": custom_modules
        }
    }

@app.get("/debug/environment")
def debug_environment():
    """환경 디버깅 엔드포인트"""
    return {
        "python_version": sys.version,
        "python_paths": sys.path[:10],
        "environment_variables": {
            "AWS_EXECUTION_ENV": os.environ.get('AWS_EXECUTION_ENV'),
            "PYTHONPATH": os.environ.get('PYTHONPATH', 'Not set'),
            "AWS_LAMBDA_FUNCTION_NAME": os.environ.get('AWS_LAMBDA_FUNCTION_NAME')
        },
        "opt_directory": {
            "exists": os.path.exists('/opt'),
            "contents": os.listdir('/opt') if os.path.exists('/opt') else []
        }
    }

@app.get("/debug/psycopg2-detailed")
def debug_psycopg2_detailed():
    """psycopg2 상세 디버깅 엔드포인트"""
    debug_info = {
        "psycopg2_status": postgresql_status,
        "python_paths": sys.path[:15],
        "pythonpath_env": os.environ.get('PYTHONPATH', 'Not set'),
        "psycopg2_search_results": []
    }
    
    search_paths = [
        '/opt/python/lib/python3.9/site-packages/psycopg2',
        '/opt/python/psycopg2',
        '/opt/psycopg2',
        '/var/task/psycopg2',
        '/var/runtime/psycopg2'
    ]
    
    for path in search_paths:
        search_result = {"path": path, "exists": os.path.exists(path)}
        if search_result["exists"]:
            try:
                contents = os.listdir(path)
                search_result["contents"] = contents[:20]
                search_result["has_init"] = "__init__.py" in contents
                search_result["so_files"] = [f for f in contents if f.endswith('.so')]
            except Exception as e:
                search_result["error"] = str(e)
        debug_info['psycopg2_search_results'].append(search_result)
    
    return debug_info

@app.post("/fast_api/auth/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """회원가입 엔드포인트"""
    try:
        logger.info(f"Attempting to register user: {user.username}")
        db_user = create_user(db, user)
        logger.info(f"Successfully registered user: {user.username}")
        return db_user
    except ValueError as e:
        logger.warning(f"Registration validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/fast_api/auth/token", response_model=Token)
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
                detail="Incorrect username or password",
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
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/fast_api/auth/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """현재 사용자 정보 조회 엔드포인트"""
    try:
        logger.info(f"User info request for: {current_user.username}")
        return current_user
    except Exception as e:
        logger.error(f"User info retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# 전역 예외 핸들러
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception handler caught: {exc}")
    return {
        "error": "Internal server error", 
        "detail": str(exc),
        "path": str(request.url) if hasattr(request, 'url') else 'unknown'
    }

# Mangum 어댑터 생성 (이름 변경으로 충돌 방지)
mangum_adapter = Mangum(app, lifespan="off")

def lambda_handler(event, context):
    """Lambda 함수의 메인 핸들러 (이름 변경)"""
    logger.info(f"Lambda invoked with event: {json.dumps(event, default=str)}")
    try:
        return mangum_adapter(event, context)
    except Exception as e:
        logger.error(f"Lambda handler error: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error": "Internal server error", "detail": str(e)})
        }

# 별칭 제공 (기존 설정과의 호환성을 위해)
handler = lambda_handler
