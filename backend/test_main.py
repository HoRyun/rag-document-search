import pytest
import os
from fastapi.testclient import TestClient
import random
import string
from unittest.mock import patch, MagicMock
from datetime import datetime
from fastapi import HTTPException, status

# 테스트 모드 설정(github actions 테스트 환경에서 사용)
os.environ['TEST_MODE'] = 'True'

# 모의 사용자 객체 생성 (Pydantic 호환)
class MockUser:
    def __init__(self):
        self.id = 1
        self.username = "testuser"
        self.email = "test@example.com"
        self.password_hash = "hashed_password_string"
        self.created_at = datetime.now()

    # Pydantic 모델이 dict 형태로 변환할 수 있도록 추가
    def __getitem__(self, item):
        return getattr(self, item)

    def __iter__(self):
        yield from {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at,
        }.items()

mock_user = MockUser()

# 인증 관련 함수 모킹
def mock_verify_password(plain_password, hashed_password):
    return True

def mock_get_password_hash(password):
    return "hashed_password_string"

def mock_authenticate_user(db, username, password):
    return mock_user

def mock_create_access_token(data, expires_delta=None):
    return "fake_access_token"

# 의존성 오버라이드를 위한 설정
def get_test_db():
    db = MagicMock()
    try:
        yield db
    finally:
        pass

def get_test_current_user():
    return mock_user

# 패치 경로 변경 및 모듈화된 구조에 맞게 수정
with patch('core.security.verify_password', mock_verify_password), \
     patch('core.security.get_password_hash', mock_get_password_hash), \
     patch('core.security.authenticate_user', mock_authenticate_user), \
     patch('core.security.create_access_token', mock_create_access_token), \
     patch('db.database.engine'), \
     patch('db.database.SessionLocal'):

    from main import app
    from api.v1.endpoints.auth import register_user
    from core.security import get_current_user
    from db.database import get_db

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = get_test_current_user

client = TestClient(app)

def test_dummy():
    assert True

@pytest.mark.skip(reason="Ollama 서비스 의존성으로 인해 CI/CD 환경에서 건너뜀")
def test_query_endpoint():
    assert True

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def test_register_endpoint_success():
    """회원가입 성공 테스트"""
    # DB 세션 모킹 함수 수정
    def get_test_db_for_register():
        db = MagicMock()
        # 중복 사용자 검사에서 None 반환 (중복 없음)
        db.query().filter().first.return_value = None

        # db.add(user) 호출 시 user 객체에 id와 created_at 설정
        def mock_add(user):
            user.id = 1  # id를 명시적으로 설정
            user.created_at = datetime.now()  # created_at을 명시적으로 설정

        db.add.side_effect = mock_add

        try:
            yield db
        finally:
            pass

    # 원래 오버라이드 저장
    original_overrides = app.dependency_overrides.copy()
    # DB 세션 의존성 오버라이드
    app.dependency_overrides[get_db] = get_test_db_for_register

    try:
        # 엔드포인트 경로 수정
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": f"testuser_{generate_random_string()}",
                "email": f"test_{generate_random_string()}@example.com",
                "password": "testpassword123"
            }
        )

        # 응답 확인
        assert response.status_code == 200, f"응답 내용: {response.text}"

        data = response.json()
        assert data["id"] == 1
        assert "username" in data

    finally:
        # 테스트 후 원래 의존성으로 복원
        app.dependency_overrides = original_overrides



def test_register_endpoint_duplicate():
    def mock_duplicate_user(*args, **kwargs):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    original_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[register_user] = mock_duplicate_user
    
    try:
        # 엔드포인트 경로 수정
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "existing_user",
                "email": "existing@example.com",
                "password": "password123"
            }
        )
        
        assert response.status_code == 400, f"응답 내용: {response.text}"
        
    finally:
        app.dependency_overrides = original_overrides


def test_login_endpoint():
    with patch('core.security.authenticate_user', return_value=mock_user):
        # 엔드포인트 경로 수정
        response = client.post(
            "/api/v1/auth/token",
            data={
                "username": "testuser",
                "password": "password"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
    
    assert response.status_code == 200, f"응답 내용: {response.text}"
    
    data = response.json()
    
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_user_me_endpoint():
    # 엔드포인트 경로 수정
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer fake_token"}
    )
    
    assert response.status_code == 200, f"응답 내용: {response.text}"
    
    assert response.json()["username"] == "testuser"
