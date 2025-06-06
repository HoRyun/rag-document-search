import os
import tempfile
import dotenv

dotenv.load_dotenv()


#AWS RDS Setting
RDS_ENDPOINT = os.environ.get('RDS_ENDPOINT')
RDS_USER = os.environ.get('RDS_USER')
RDS_PASSWORD = os.environ.get('RDS_PASSWORD')
RDS_DB_NAME = os.environ.get('RDS_DB_NAME')

#Amazon S3 Setting
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.environ.get("AWS_DEFAULT_REGION")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")

# .env 파일에 TEST_MODE 키가 true이면 테스트 모드가 활성화되고, 없거나 False로 설정되어 있으면 테스트 모드가 비활성화됩니다.
# 이 코드는 github actions 테스트 환경에서 사용되는 코드입니다. 
# actions 실행 시 TEST_MODE 환경변수는 true로 변경된다.
# 본인 .env 파일에 TEST_MODE=false로 설정하면 그 설정이 우선 적용되므로 테스트 모드가 비활성화됩니다.
# 아래 코드는 TEST_MODE를 false로 설정한다.
TEST_MODE = os.environ.get('TEST_MODE', 'False').lower() == 'true'

# 업로드 디렉토리 설정
# 테스트 모드일 경우 업로드 되는 파일은 임시 디렉토리에 저장됨.
# 임시 디렉토리에 저장될 경우 테스트 종료 후 임시 디렉토리 삭제됨.
# /data/uploads는 더 이상 사용하지 않는데 진짜 사용하지 않는지 확인하고 25번째 줄의 else문 아래의 코드를 삭제하기.<- 필요없으므로 삭제했음.
if TEST_MODE:
    UPLOAD_DIR = tempfile.mkdtemp()
    print(f"Using temporary directory for uploads: {UPLOAD_DIR}")
else:
    UPLOAD_DIR = "uploads"

# 데이터베이스 연결 주소 설정 (도커 컨테이너 환경의 경우 해당 값 적용)

# 테스트 모드가 설정되어 있는지 확인
TEST_MODE = os.getenv("TEST_MODE", "False").lower() in ("true", "1", "t")

# 테스트용 데이터베이스 URL
if TEST_MODE:
    DATABASE_URL = "sqlite:///./test.db"  # 메모리 DB 또는 파일 기반 SQLite
# 로컬 Windows 환경에서 사용할 URL
elif os.name == 'nt':  # Windows 환경
    # Amazon RDS 환경에서 사용할 URL
    DATABASE_URL = f"postgresql+psycopg2://{RDS_USER}:{RDS_PASSWORD}@{RDS_ENDPOINT}:5432/{RDS_DB_NAME}?client_encoding=utf8"
    # 프로그램 종료 시 까지 이 주소를 유지
    os.environ['DATABASE_URL'] = DATABASE_URL
else:
    # Docker 환경에서 사용할 URL
    DATABASE_URL = f"postgresql+psycopg2://{RDS_USER}:{RDS_PASSWORD}@{RDS_ENDPOINT}:5432/{RDS_DB_NAME}?client_encoding=utf8"
    # Docker 환경 변수 설정
    os.environ['DOCKER_ENV'] = 'true'

print(f"Using database URL: {DATABASE_URL}")


# 토큰 설정
# 기본값은 30분이다.
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 테스트를 위해 토큰 제한 시간을 1분으로 설정한다.
# ACCESS_TOKEN_EXPIRE_MINUTES = 1
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-for-jwt")
ALGORITHM = "HS256" 


