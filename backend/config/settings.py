import os
import tempfile
import dotenv

dotenv.load_dotenv()

# .env 파일에 TEST_MODE 키가 true이면 테스트 모드가 활성화되고, 없거나  False로 설정되어 있으면 테스트 모드가 비활성화됩니다.
# 이 코드는 github actions 테스트 환경에서 사용되는 코드입니다. 
# actions 실행 시 어차피 true로 변경되므로 평소 개발 테스트 시에는 비활성화 하기.
# 본인 .env 파일에 TEST_MODE=false로 설정하면 그 설정이 우선 적용되므로 테스트 모드가 비활성화됩니다.
TEST_MODE = os.environ.get('TEST_MODE', 'False').lower() == 'true'

OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'localhost')
OLLAMA_PORT = os.environ.get('OLLAMA_PORT', '11434')




# 업로드 디렉토리 설정
# 테스트 모드일 경우 업로드 되는 파일은 임시 디렉토리에 저장됨.
# 임시 디렉토리에 저장될 경우 테스트 종료 후 임시 디렉토리 삭제됨.
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