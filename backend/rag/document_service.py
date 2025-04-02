import os

from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json
from typing import Tuple, List, Dict, Any

from langchain_core.documents import Document as LangchainDocument
from langchain.chains.retrieval_qa.base import RetrievalQA

import faiss
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore



# 함수 불러오기
from db.models import Document, DocumentChunk

from rag.embeddings import get_embeddings
from rag.vectorstore import create_vector_store, get_vector_store, save_to_vector_store
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

# def safe_json_serializable(data):
#     """JSON으로 직렬화할 수 있는 데이터만 반환.
#     보조 기능 함수.
#     """
#     try:
#         # JSON 직렬화 시도
#         json.dumps(data)
#         return data
#     except (TypeError, OverflowError):
#         # 직렬화할 수 없는 경우 문자열로 변환
#         if isinstance(data, dict):
#             return {k: safe_json_serializable(v) for k, v in data.items()}
#         elif isinstance(data, list):
#             return [safe_json_serializable(item) for item in data]
#         else:
#             return str(data)

async def process_document(
    file: UploadFile, 
    user_id: int, 
    db: Session
) -> int:
    """문서 업로드 및 처리
    주 기능 함수.
    """
    # 파일 확장자 확인
    file_extension = file.filename.split('.')[-1].lower()
    supported_extensions = ['pdf', 'hwp', 'hwpx', 'docx']
    
    if file_extension not in supported_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Only {', '.join(supported_extensions)} files are supported"
        )
    
    # # 파일 저장 
    # 현재 필요하지 않은 기능이므로 우선 주석처리.
    # file_path= save_uploaded_file(file, file.filename)
    
    try:
        # DB의 documents 테이블에 문서 정보 저장.
        db_document = Document(
            filename=file.filename, 
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
        save_to_vector_store(chunked_documents)
        
        print(f"Document {os.path.basename(file.filename)} uploaded and processed successfully")


        # # 청크 준비
        # chunks = prepare_chunks(documents, file.filename, timestamp)
        
        # # 벡터 스토어에 문서 추가 시도
        # try:
        #     vector_store = get_vector_store()
        #     vector_store.add_documents(chunks)
        # except Exception as e:
        #     print(f"벡터 스토어 추가 오류: {str(e)}")
        #     # 대체 방법으로 한 번에 하나씩 청크 추가 시도
        #     try:
        #         vector_store = get_vector_store()
        #         for i, chunk in enumerate(chunks):
        #             try:
        #                 # 청크 내용에서 문제가 되는 문자 제거
        #                 chunk.page_content = clean_text(chunk.page_content)
        #                 # 메타데이터 정리
        #                 chunk.metadata = safe_json_serializable(chunk.metadata)
        #                 vector_store.add_documents([chunk])
        #                 print(f"청크 {i+1}/{len(chunks)} 추가 성공")
        #             except Exception as chunk_error:
        #                 print(f"청크 {i+1}/{len(chunks)} 추가 실패: {str(chunk_error)}")
        #                 continue
        #     except Exception as fallback_error:
        #         print(f"대체 방법 실패: {str(fallback_error)}")
        #         # 벡터 스토어 추가가 실패해도 계속 진행
        
        # # DB에 청크 정보 저장
        # for chunk in chunks:
        #     try:
        #         # 청크 내용 정리
        #         content = clean_text(chunk.page_content)
        #         # 메타데이터 정리
        #         metadata = safe_json_serializable(chunk.metadata)
                
        #         db_chunk = DocumentChunk(
        #             document_id=db_document.id,
        #             content=content,
        #             meta=metadata
        #         )
        #         db.add(db_chunk)
        #     except Exception as chunk_db_error:
        #         print(f"청크 DB 저장 오류: {str(chunk_db_error)}")
        #         continue
        
        # db.commit()
        
        return 200
        
    except Exception as e:
        # db.rollback()
        import traceback
        print(f"Error processing document: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

def query_documents(query: str) -> str:
    """문서 질의응답"""
    try:
        # 벡터 스토어 가져오기
        vector_store = get_vector_store()
        
        # 질의 실행, 2번째 파라미터로 retriever(검색기) 전달
        result = get_llms_answer(query, vector_store.as_retriever())
        
        return result
    except Exception as e:
        import traceback
        print(f"Error querying documents: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error querying documents: {str(e)}") 