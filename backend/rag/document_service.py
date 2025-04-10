import os

from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json
from typing import Tuple, List, Dict, Any
import traceback

from langchain_core.documents import Document as LangchainDocument
from langchain.chains.retrieval_qa.base import RetrievalQA

# FAISS 관련 임포트 (주석 처리)
# import faiss
# from langchain_community.vectorstores import FAISS
# from langchain_community.docstore.in_memory import InMemoryDocstore

# 함수 불러오기
from db.models import Document, DocumentChunk

from rag.retriever import get_reretriever
from rag.embeddings import get_embeddings
# FAISS 관련 함수 임포트 (주석 처리)
# from rag.vectorstore import create_vector_store, get_vector_store
from rag.vectorstore import save_to_vector_store, get_pg_vector_store
from rag.llm import get_llms_answer
from rag.file_load import (
    load_pdf, 
    load_docx, 
    load_hwp, 
)
from rag.chunking import chunk_documents


def get_all_documents(db: Session):
    """모든 문서 조회"""
    return db.query(Document).all()


# # TODO: 나중에 삭제될 함수로 현재 사용하지 않음.
# def prepare_chunks(documents, filename, timestamp):
#     """텍스트를 청크로 분할하고 메타데이터 추가"""
#     # 여기에서 청크 준비 로직을 구현합니다
#     # ...
#     return documents


async def process_document(
    file: UploadFile, 
    user_id: int, 
    db: Session
) -> int:
    """문서 업로드 및 처리"""
    # 파일 확장자 추출
    file_extension = file.filename.split('.')[-1].lower()
    
    # 지원되는 파일 형식 확인
    if file_extension not in ['pdf', 'docx', 'hwp', 'hwpx']:
        raise HTTPException(
            status_code=400, 
            detail="지원되지 않는 파일 형식입니다. PDF, DOCX, HWP 또는 HWPX 파일만 업로드 가능합니다."
        )
    
    # # 파일 저장 
    # 현재 필요하지 않은 기능이므로 우선 주석처리.
    # file_path= save_uploaded_file(file, file.filename)
    
    try:
        # DB의 documents 테이블에 문서 정보 저장. # 이 코드는 이 위치에 있어야 함.
        db_document = Document(
            filename=os.path.basename(file.filename), 
            upload_time=datetime.now(), 
            user_id=user_id
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)



        # 파일 형식에 따라 문서 로드
        if file_extension == 'pdf':
            documents = await load_pdf(file)
        elif file_extension == 'docx':
            documents = load_docx(file)
        elif file_extension in ['hwp', 'hwpx']:
            documents = load_hwp(file, file_extension)
        
        # 문서 청킹
        chunked_documents = chunk_documents(documents, file.filename)

        # 벡터 스토어에 저장
        try:
            save_to_vector_store(chunked_documents)
            print(f"Document {os.path.basename(file.filename)} uploaded and processed successfully")
        except Exception as ve:
            print(f"벡터 저장 중 오류 발생, 하지만 청킹된 문서는 처리되었습니다: {str(ve)}")
            print(traceback.format_exc())
            # 벡터 저장 실패해도 문서 자체는 업로드 성공으로 처리

        return 200
        
    except Exception as e:
        # 오류 발생 시 처리
        db.rollback()  # 트랜잭션 롤백
        print(f"Error processing document: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")


def process_query(query: str) -> str:
    """문서 질의응답"""
    try:
        # PostgreSQL 벡터 스토어만 사용
        vector_store = get_pg_vector_store()
        
        # 기존 FAISS 벡터 스토어 코드 (주석 처리)
        # if use_pg_vector:
        #     # PostgreSQL 벡터 스토어 사용
        #     vector_store = get_pg_vector_store()
        # else:
        #     # FAISS 벡터 스토어 사용 (기본값)
        #     vector_store = get_vector_store()
        
        # reretriever 생성
        reretriever = get_reretriever(vector_store)

        # 질의 실행, 2번째 파라미터로 retriever(검색기) 전달
        result = get_llms_answer(query, reretriever)
        
        return result
    except Exception as e:
        print(f"Error querying documents: {str(e)}")
        print(traceback.format_exc())
        # 오류 발생 시 사용자 친화적인 메시지 반환
        return f"검색 중 오류가 발생했습니다. 관리자에게 문의하세요. 오류 정보: {str(e)[:100]}..." 