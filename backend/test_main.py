# backend/test_main.py
import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from langchain.schema import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# main.py에서 필요한 함수와 앱 가져오기
from main import app, get_llm

# 테스트 클라이언트 생성
client = TestClient(app)

@pytest.fixture
def test_vector_store():
    """테스트용 임시 벡터 스토어 생성"""
    # 임시 디렉토리 생성
    temp_dir = tempfile.mkdtemp()
    
    # 테스트용 임베딩 모델 설정
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    # 테스트용 벡터 스토어 생성
    vector_store = Chroma(
        collection_name="test_documents",
        embedding_function=embeddings,
        persist_directory=temp_dir
    )
    
    # 테스트 문서 추가
    test_docs = [
        Document(page_content="이것은 테스트 문서입니다. RAG 시스템 테스트를 위한 내용입니다.", 
                 metadata={"source": "test1.txt"}),
        Document(page_content="인공지능과 자연어 처리에 관한 테스트 문서입니다.", 
                 metadata={"source": "test2.txt"})
    ]
    vector_store.add_documents(test_docs)
    
    # 테스트에서 사용할 벡터 스토어 반환
    yield vector_store
    
    # 테스트 후 임시 디렉토리 정리
    import shutil
    shutil.rmtree(temp_dir)

# 모의 LLM 응답을 위한 패치 설정
@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    """LLM을 모의 객체로 대체"""
    def mock_get_llm():
        class MockLLM:
            def invoke(self, prompt):
                return "이것은 테스트 응답입니다."
        return MockLLM()
    
    # get_llm 함수를 모의 함수로 대체
    monkeypatch.setattr("main.get_llm", mock_get_llm)

def test_query_endpoint(test_vector_store, monkeypatch):
    """쿼리 엔드포인트 테스트"""
    # 벡터 스토어 가져오기 함수를 모의 함수로 대체
    def mock_get_vector_store():
        return test_vector_store
    
    monkeypatch.setattr("main.get_vector_store", mock_get_vector_store)
    
    # 쿼리 요청 테스트
    response = client.post("/query", data={"query": "인공지능이란 무엇인가요?"})
    
    # 응답 검증
    assert response.status_code == 200
    assert "answer" in response.json()
    
def test_dummy():
    """더미 테스트 - 항상 통과"""
    assert True
