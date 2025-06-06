import json
import sys
import os
import logging
import importlib

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lambda 환경에서 모든 레이어 경로 설정
if os.environ.get('AWS_EXECUTION_ENV') is not None:
    # 여러 레이어 경로를 순서대로 추가
    layer_paths = [
        '/opt/python',
        '/opt/python/lib/python3.9/site-packages',  # Python 3.11로 수정
        '/opt'
    ]
    
    for path in layer_paths:
        if path not in sys.path and os.path.exists(path):
            sys.path.insert(0, path)
    
    logger.info("Lambda environment detected, added layer paths to sys.path")
    logger.info(f"Python path: {sys.path[:5]}")
    
    # /opt 디렉토리 구조 확인
    if os.path.exists('/opt'):
        opt_contents = os.listdir('/opt')
        logger.info(f"Contents of /opt: {opt_contents}")
        
        if 'python' in opt_contents:
            python_contents = os.listdir('/opt/python')
            logger.info(f"Contents of /opt/python: {python_contents}")

# PostgreSQL 관련 모듈 import 확인
postgresql_modules = {}
try:
    import psycopg2
    postgresql_modules['psycopg2'] = psycopg2.__version__
    logger.info(f"✓ psycopg2 imported successfully: {psycopg2.__version__}")
except ImportError as e:
    postgresql_modules['psycopg2'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import psycopg2: {e}")

try:
    import pgvector
    postgresql_modules['pgvector'] = pgvector.__version__ if hasattr(pgvector, '__version__') else 'version unknown'
    logger.info(f"✓ pgvector imported successfully")
except ImportError as e:
    postgresql_modules['pgvector'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import pgvector: {e}")

try:
    import numpy
    postgresql_modules['numpy'] = numpy.__version__
    logger.info(f"✓ numpy imported successfully: {numpy.__version__}")
except ImportError as e:
    postgresql_modules['numpy'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import numpy: {e}")

# 외부 의존성 import
try:
    from fastapi import FastAPI, Depends, HTTPException, status
    from fastapi.middleware.cors import CORSMiddleware
    from mangum import Mangum
    from sqlalchemy.orm import Session
    logger.info("✓ External dependencies imported successfully")
except ImportError as e:
    logger.error(f"✗ Failed to import external dependencies: {e}")
    raise

# 커스텀 모듈 import (에러 처리 강화)
custom_modules = {}
try:
    # db 모듈 존재 확인
    import db
    custom_modules['db'] = f"Found at: {db.__file__ if hasattr(db, '__file__') else 'built-in'}"
    logger.info(f"✓ db module found at: {db.__file__ if hasattr(db, '__file__') else 'built-in'}")
    
    from db.database import get_db
    from db.models import User
    from db.schemas import UserResponse
    custom_modules['db_submodules'] = "All db submodules imported successfully"
    logger.info("✓ db modules imported successfully")
except ImportError as e:
    custom_modules['db'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import db modules: {e}")
    # db 모듈 경로 직접 확인
    possible_paths = ['/opt/python/db', '/opt/db']
    for path in possible_paths:
        if os.path.exists(path):
            logger.info(f"Found db module at: {path}")
            if path not in sys.path:
                sys.path.insert(0, os.path.dirname(path))
    raise

try:
    from fast_api.security import get_current_user
    custom_modules['fast_api'] = "Security modules imported successfully"
    logger.info("✓ fast_api.security imported successfully")
except ImportError as e:
    custom_modules['fast_api'] = f"Import failed: {e}"
    logger.error(f"✗ Failed to import fast_api.security: {e}")
    raise

app = FastAPI(
    title="AI Document API - Users",
    description="User management endpoints with layer debugging",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 구체적인 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    """헬스체크 엔드포인트"""
    return {
        "message": "AI Document API Users service is running",
        "status": "healthy",
        "python_path_count": len(sys.path),
        "lambda_env": bool(os.environ.get('AWS_EXECUTION_ENV')),
        "layers_summary": {
            "dependencies": "FastAPI, Pydantic, Mangum, SQLAlchemy",
            "postgresql": len([k for k, v in postgresql_modules.items() if "Import failed" not in str(v)]),
            "custom": "db, fast_api modules"
        }
    }

@app.get("/debug/layers")
def debug_layers():
    """레이어별 상세 정보 확인 엔드포인트"""
    layer_info = {
        "layer_1_dependencies": {
            "description": "FastAPI, Pydantic, Mangum, SQLAlchemy",
            "packages": {}
        },
        "layer_2_postgresql": {
            "description": "PostgreSQL connectivity and vector support",
            "packages": postgresql_modules
        },
        "layer_3_custom": {
            "description": "Custom modules (db, fast_api)",
            "packages": custom_modules
        }
    }
    
    # Dependencies layer 패키지 확인
    dependencies_packages = {}
    for package_name in ['fastapi', 'pydantic', 'mangum', 'sqlalchemy']:
        try:
            module = importlib.import_module(package_name)
            version = getattr(module, '__version__', 'version unknown')
            dependencies_packages[package_name] = f"✓ {version}"
        except ImportError as e:
            dependencies_packages[package_name] = f"✗ Import failed: {e}"
    
    layer_info["layer_1_dependencies"]["packages"] = dependencies_packages
    
    # 파일 시스템 구조 확인
    if os.environ.get('AWS_EXECUTION_ENV'):
        filesystem_info = {}
        
        # /opt/python 구조 확인
        if os.path.exists('/opt/python'):
            try:
                python_dirs = [d for d in os.listdir('/opt/python') if os.path.isdir(os.path.join('/opt/python', d))]
                filesystem_info['opt_python_directories'] = python_dirs[:20]
            except Exception as e:
                filesystem_info['opt_python_directories'] = f"Error: {e}"
        
        # 커스텀 모듈 경로 확인
        custom_paths = {}
        for module_name in ['db', 'fast_api']:
            module_path = f'/opt/python/{module_name}'
            if os.path.exists(module_path):
                try:
                    files = os.listdir(module_path)
                    custom_paths[module_name] = files
                except Exception as e:
                    custom_paths[module_name] = f"Error reading: {e}"
            else:
                custom_paths[module_name] = "Directory not found"
        
        filesystem_info['custom_modules'] = custom_paths
        layer_info['filesystem'] = filesystem_info
    
    return layer_info

@app.get("/debug/imports")
def debug_imports():
    """모든 import 상태를 테스트하는 엔드포인트"""
    import_results = {}
    
    # 외부 의존성 테스트
    external_deps = ['fastapi', 'pydantic', 'mangum', 'sqlalchemy', 'psycopg2', 'pgvector', 'numpy']
    for dep in external_deps:
        try:
            module = importlib.import_module(dep)
            version = getattr(module, '__version__', 'unknown')
            import_results[dep] = {"status": "✓ Success", "version": version}
        except ImportError as e:
            import_results[dep] = {"status": "✗ Failed", "error": str(e)}
    
    # 커스텀 모듈 테스트
    custom_imports = [
        'db.database',
        'db.models', 
        'db.schemas',
        'fast_api.security'
    ]
    
    for module_path in custom_imports:
        try:
            importlib.import_module(module_path)
            import_results[module_path] = {"status": "✓ Success"}
        except ImportError as e:
            import_results[module_path] = {"status": "✗ Failed", "error": str(e)}
    
    return {
        "import_test_results": import_results,
        "summary": {
            "total_tested": len(import_results),
            "successful": len([r for r in import_results.values() if "✓" in r["status"]]),
            "failed": len([r for r in import_results.values() if "✗" in r["status"]])
        }
    }

@app.get("/debug/paths")
def debug_paths():
    """디버깅용 경로 정보 엔드포인트"""
    if os.environ.get('AWS_EXECUTION_ENV'):
        return {
            "python_paths": sys.path[:10],
            "opt_exists": os.path.exists('/opt'),
            "opt_python_exists": os.path.exists('/opt/python'),
            "opt_contents": os.listdir('/opt') if os.path.exists('/opt') else [],
            "opt_python_contents": os.listdir('/opt/python') if os.path.exists('/opt/python') else []
        }
    else:
        return {"message": "Not in Lambda environment"}

@app.get("/fast_api/users", response_model=list[UserResponse])
def get_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """사용자 목록 조회 엔드포인트"""
    try:
        logger.info(f"Getting users with skip={skip}, limit={limit}")
        
        # 관리자 권한 체크 (주석 해제 시 사용)
        # if not current_user.is_admin:
        #     logger.warning(f"Non-admin user {current_user.username} attempted to access user list")
        #     raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다.")
        
        users = db.query(User).offset(skip).limit(limit).all()
        logger.info(f"Successfully retrieved {len(users)} users")
        return users
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving users: {e}")
        raise HTTPException(
            status_code=500, 
            detail="사용자 목록을 가져오는 중 오류가 발생했습니다."
        )

@app.get("/fast_api/users/count")
def get_users_count(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """사용자 수 조회 엔드포인트"""
    try:
        count = db.query(User).count()
        return {"total_users": count}
    except Exception as e:
        logger.error(f"Error counting users: {e}")
        raise HTTPException(status_code=500, detail="사용자 수를 가져오는 중 오류가 발생했습니다.")

# 전역 예외 핸들러
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}")
    return {
        "error": "Internal server error",
        "detail": str(exc),
        "path": str(request.url) if hasattr(request, 'url') else 'unknown'
    }

# Lambda 핸들러
handler = Mangum(app, lifespan="off")

# Lambda 함수 진입점
def lambda_handler(event, context):
    """Lambda 함수의 메인 핸들러"""
    logger.info(f"Lambda invoked with event: {json.dumps(event, default=str)}")
    try:
        return handler(event, context)
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
