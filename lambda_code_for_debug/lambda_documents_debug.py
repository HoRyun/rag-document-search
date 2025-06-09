import json
import logging
import sys
import os
from datetime import datetime
from typing import Annotated

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy.orm import Session

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
    from sqlalchemy import text
    logger.info("✓ Successfully imported external dependencies")
except ImportError as e:
    logger.error(f"✗ Failed to import external dependencies: {e}")
    raise

# 커스텀 모듈 import
custom_modules = {}
try:
    from db.database import get_db
    from db.models import User
    from db import crud
    custom_modules['db'] = "✓ All db modules imported successfully"
    logger.info("✓ db modules imported successfully")
except ImportError as e:
    custom_modules['db'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import db modules: {e}")
    raise

try:
    from fast_api.security import get_current_user
    custom_modules['fast_api'] = "✓ Security modules imported successfully"
    logger.info("✓ fast_api.security imported successfully")
except ImportError as e:
    custom_modules['fast_api'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import fast_api.security: {e}")
    raise

# FastAPI 앱 생성
app = FastAPI(
    title="AI Document API - Documents",
    description="Document management service for AI Document Management System",
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
    """루트 엔드포인트"""
    return {
        "message": "AI Document API - Documents service is running", 
        "status": "healthy",
        "python_path_count": len(sys.path),
        "lambda_env": bool(os.environ.get('AWS_EXECUTION_ENV')),
        "layers_status": {
            "dependencies": "✓ FastAPI, Mangum, SQLAlchemy loaded",
            "postgresql": postgresql_status,
            "custom": custom_modules
        }
    }

@app.get("/health")
def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "healthy", "service": "documents", "timestamp": datetime.utcnow()}

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

@app.get("/fast_api/documents")
def list_items(
    path: str = Query("/", description="현재 경로"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """지정된 경로의 파일 및 폴더 목록을 반환"""
    try:
        filtered_items = []
        user_id = current_user.id

        # 루트 디렉토리가 존재하지 않으면 생성
        if not crud.get_directory_by_id(db, "root"):
            crud.create_directory(db, "root", "/", True, None, datetime.now())

        selected_path = path

        # 커넥션 풀에서 직접 연결 가져오기
        with db.connection() as connection:
            # 파일 목록 쿼리
            file_query = text("""
                SELECT id, name, 'file' as type, path 
                FROM directories 
                WHERE path LIKE :selected_path || '/%' 
                AND path NOT LIKE :selected_path || '/%/%' 
                AND is_directory = FALSE
                AND owner_id = :user_id
            """)
            file_result = connection.execute(file_query, {"selected_path": selected_path, "user_id": user_id}).mappings().fetchall()
            
            # 디렉토리 목록 쿼리
            dir_query = text("""
                SELECT id, name, 'folder' as type, path 
                FROM directories 
                WHERE path LIKE :selected_path || '/%' 
                AND path NOT LIKE :selected_path || '/%/%' 
                AND is_directory = TRUE
                AND id <> 'root'
                AND owner_id = :user_id
            """)
            dir_result = connection.execute(dir_query, {"selected_path": selected_path, "user_id": user_id}).mappings().fetchall()

        # 가져온 정보를 filtered_items에 추가
        filtered_items.extend([dict(item) for item in file_result])
        filtered_items.extend([dict(item) for item in dir_result])
        
        logger.info(f"Retrieved {len(filtered_items)} items for user: {current_user.username} at path: {path}")
        return {"items": filtered_items}
    except Exception as e:
        logger.error(f"Error listing items: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing items: {str(e)}")

@app.get("/fast_api/documents/structure")
async def get_filesystem_structure(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """전체 파일 시스템 구조 반환"""
    try:
        user_id = current_user.id

        # 루트 디렉토리가 존재하지 않으면 생성
        if not crud.get_directory_by_id(db, "root"):
            crud.create_directory(db, "root", "/", True, None, datetime.now())

        # 디렉토리만 필터링
        directories = crud.get_only_directory(db, user_id)

        # 최상위 디렉토리 이름(root) 찾기
        root = next((d['name'] for d in directories if d['parent_id'] == "root"), None)
        if not root:
            logger.warning(f"No root directory found for user: {current_user.username}")

        # 새 리스트에 수정된 객체 생성
        your_result = []
        for d in directories:
            # 루트 디렉토리는 제외
            if d['id'] == "root":
                continue
            your_result.append({
                'id': d['id'],
                'name': d['name'],
                'path': d['path']
            })
        
        directories = your_result

        logger.info(f"Retrieved {len(directories)} directories for user: {current_user.username}")
        return {"directories": directories}
    except Exception as e:
        logger.error(f"Error fetching filesystem structure: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching filesystem structure: {str(e)}")

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
