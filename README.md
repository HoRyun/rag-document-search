[![RAG System CI/CD Pipeline](https://github.com/HoRyun/rag-document-search/actions/workflows/rag-ci-cd.yml/badge.svg)](https://github.com/HoRyun/rag-document-search/actions/workflows/rag-ci-cd.yml)

RAG Document Search는 Retrieval-Augmented Generation(RAG) 기술을 활용한 문서 검색 및 질의응답 시스템입니다. 이 시스템은 문서를 업로드하고, 해당 문서에 대한 질문을 할 수 있는 기능을 제공합니다.

주요 기능
문서 업로드 및 관리

문서 텍스트 추출 및 벡터화

자연어 질의에 대한 정확한 응답 생성

직관적인 사용자 인터페이스

기술 스택
백엔드: FastAPI, LangChain, ChromaDB, PostgreSQL

프론트엔드: React

벡터 데이터베이스: ChromaDB -> PostgreSQL 변경 예정

사용자 데이터베이스 : PostgreSQL

LLM: Ollama (llama2 모델)

컨테이너화: Docker, Docker Compose

설치 가이드

1. Docker Desktop 설치

2. 현재 레포지토리 로컬에 Clone 한 후 터미널에서 해당 위치로 이동
    
3. docker-compose up --build 입력
