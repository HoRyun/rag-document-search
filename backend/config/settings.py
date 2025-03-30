import os
import tempfile

# 환경 변수 설정
DATA_DIR = "/data"
TEST_MODE = os.environ.get('TEST_MODE', 'False').lower() == 'true'
OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'localhost')
OLLAMA_PORT = os.environ.get('OLLAMA_PORT', '11434')


# 업로드 디렉토리 설정
if TEST_MODE:
    UPLOAD_DIR = tempfile.mkdtemp()
    print(f"Using temporary directory for uploads: {UPLOAD_DIR}")
else:
    UPLOAD_DIR = os.environ.get('UPLOAD_DIR', '/data/uploads')

os.makedirs(UPLOAD_DIR, exist_ok=True)

# 데이터베이스 설정
DATABASE_URL = "postgresql+psycopg2://postgres:postgres@db:5432/ragdb"

# 토큰 설정
# 기본값은 30분이다.
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 테스트를 위해 토큰 제한 시간을 1분으로 설정한다.
# ACCESS_TOKEN_EXPIRE_MINUTES = 1
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-for-jwt")
ALGORITHM = "HS256" 