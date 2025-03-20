[![RAG Document Search CI/CD Pipeline](https://github.com/HoRyun/rag-document-search/actions/workflows/rag-ci-cd.yml/badge.svg)](https://github.com/HoRyun/rag-document-search/actions/workflows/rag-ci-cd.yml)

# RAG Document Search

Retrieval-Augmented Generation(RAG) 기술을 활용한 문서 검색 및 질의응답 시스템입니다. 사용자는 문서를 업로드하고 해당 문서에 관련된 질문을 할 수 있습니다.

## **주요 기능**

- **문서 관리**: 문서 업로드, 조회 및 삭제
- **텍스트 처리**: 문서에서 텍스트 추출 및 벡터화
- **질의응답**: 자연어 질문에 대한 정확한 응답 생성
- **사용자 친화적 UI**: 직관적인 인터페이스 제공

## **기술 스택**

## **백엔드**

- **FastAPI**: 고성능 API 프레임워크
- **LangChain**: LLM 애플리케이션 개발 프레임워크
- **PostgreSQL**: 벡터 및 사용자 데이터 저장

## **프론트엔드**

- **React**: 사용자 인터페이스 구현

## **인프라**

- **Docker**: 애플리케이션 컨테이너화
- **Ollama**: 로컬 LLM 실행 (llama2 모델)

## **설치 방법**

1. **사전 요구사항**
    - [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치
2. **설치 및 실행**
    
    ```bash
    저장소 복제
    git clone https://github.com/yourusername/rag-document-search.git
    cd rag-document-search
    
    *애플리케이션 빌드 및 실행*
    docker-compose up --build
    ```
