from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


from config.settings import DATABASE_URL



# 데이터베이스 엔진 생성
engine = create_engine(DATABASE_URL, echo=True)

# 세션 로컬 클래스 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 데이터베이스 초기화 함수
def init_db():
    # 이 임포트는 순환 임포트를 방지하기 위해 함수 내에서 실행
    from db.models import Base
    Base.metadata.create_all(bind=engine)

# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
