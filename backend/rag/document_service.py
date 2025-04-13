import os

from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

import traceback


# 함수 불러오기
from db.models import Document



from rag.vectorstore import save_to_vector_store
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
        result = get_llms_answer(query)
        
        return result
    except Exception as e:
        print(f"Error querying documents: {str(e)}")
        print(traceback.format_exc())
        # 오류 발생 시 사용자 친화적인 메시지 반환
        return f"검색 중 오류가 발생했습니다. 관리자에게 문의하세요. 오류 정보: {str(e)[:100]}..." 