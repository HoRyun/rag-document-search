from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

from config.settings import DATABASE_URL

# 테스트 모드 확인
TEST_MODE = os.getenv("TEST_MODE", "False").lower() in ("true", "1", "t")

# 테스트용 데이터베이스 URL
if TEST_MODE:
    DATABASE_URL = "sqlite:///./test.db"  # 메모리 DB 또는 파일 기반 SQLite
elif os.environ.get('DATABASE_URL'):
    DATABASE_URL = os.environ.get('DATABASE_URL')
elif os.name == 'nt':  # Windows 환경
    # 로컬 Windows 환경에서 사용할 URL
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ragdb"
else:
    # Docker 환경에서 사용할 URL
    DATABASE_URL = "postgresql://postgres:postgres@db:5432/ragdb"

print(f"Using database URL: {DATABASE_URL}")

# 데이터베이스 엔진 생성
engine = create_engine(DATABASE_URL)

# 세션 로컬 클래스 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 데이터베이스 초기화 함수
def init_db():
    # 이 임포트는 순환 임포트를 방지하기 위해 함수 내에서 실행
    from models.models import Base
    Base.metadata.create_all(bind=engine)

# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
