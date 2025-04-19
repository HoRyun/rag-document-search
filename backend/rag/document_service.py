import os
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import traceback


# 함수 불러오기
from db.models import Document
from rag.embeddings import embed_query
from rag.vectorstore import save_to_vector_store

from rag.retriever import search_similarity, do_mmr
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
    db: Session,
    s3_key: str
) -> int:
    """문서 업로드 및 처리"""

    # 1. 업로드 된 파일의 형식을 확인한다.
    # 파일 확장자 추출
    file_extension = file.filename.split('.')[-1].lower()
     
    # 지원되는 파일 형식 확인
    if file_extension not in ['pdf', 'docx', 'hwp', 'hwpx']:
        raise HTTPException(
            status_code=400, 
            detail="지원되지 않는 파일 형식입니다. PDF, DOCX, HWP 또는 HWPX 파일만 업로드 가능합니다."
        )
    # 1. 업로드 된 파일의 형식을 확인한다.


    try:
        
        # 2. 업로드 된 파일의 정보를 db에 저장한다.
        # 업로드 된 파일의 이름, 업로드 시간, 사용자 아이디를 DB의 documents 테이블에 저장.
        # DB의 documents 테이블에 문서 정보 저장. # 이 코드는 이 위치에 있어야 함.
        db_document = Document(
            filename=os.path.basename(file.filename),
            s3_key=s3_key,
            upload_time=datetime.now(),
            user_id=user_id
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        # 2. 업로드 된 파일의 정보를 db에 저장한다.

        # 이 코드에서 에러를 발생시키므로 주석 처리
        # crud.add_directory_size(db, db_document.id, file.size)
        # 2. 업로드 된 파일의 정보를 db에 저장한다.

        # 3. 파일 형식에 따라 문서 로드
        # 파일을 읽어 문자열 리스트로 반환하는 작업을 한다.
        if file_extension == 'pdf':
            documents = await load_pdf(file)
        elif file_extension == 'docx':
            documents = await load_docx(file)
        elif file_extension in ['hwp', 'hwpx']:
            documents = load_hwp(file, file_extension)
        # 3. 파일 형식에 따라 문서 로드




        # 4. 문서 청킹
        # 문자열 리스트화 된 문서를 조각으로 나눈다.
        chunked_documents = chunk_documents(documents, file.filename)
        # 4. 문서 청킹

        # 5. 벡터 스토어에 청크들을 저장
        # 청크들을 임베딩하여 벡터 스토어에 저장한다.
        try:
            document_id = save_to_vector_store(chunked_documents)
            print(f"Document {os.path.basename(file.filename)} uploaded and processed successfully")
        except Exception as ve:
            print(f"벡터 저장 중 오류 발생 {str(ve)}")
            print(traceback.format_exc())


        return document_id
        
    except Exception as e:
        # 오류 발생 시 처리
        db.rollback()  # 트랜잭션 롤백
        print(f"Error processing document: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")


def process_query(query: str, engine) -> str:
    """사용자의 쿼리를 처리"""
    try:
        # 쿼리 임베딩
        embed_query_data = embed_query(query)

        # 검색 결과 가져오기
        search_similarity_result = search_similarity(embed_query_data, engine)

        # MMR 알고리즘 수행
        docs = do_mmr(search_similarity_result)

        return docs
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        print(traceback.format_exc())
        # 오류 발생 시 사용자 친화적인 메시지 반환
        return f"처리 중 오류가 발생했습니다. 관리자에게 문의하세요. 오류 정보: {str(e)[:100]}..." 