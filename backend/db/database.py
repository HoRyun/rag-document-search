from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# 테스트 모드 확인
TEST_MODE = os.getenv("TEST_MODE", "False").lower() in ("true", "1", "t")

# 테스트용 데이터베이스 URL
if TEST_MODE:
    DATABASE_URL = "sqlite:///./test.db"  # 메모리 DB 또는 파일 기반 SQLite
else:
    DATABASE_URL = "postgresql://postgres:postgres@db:5432/ragdb"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
