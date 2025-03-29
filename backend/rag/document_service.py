from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json
from typing import Tuple, List, Dict, Any

from langchain_core.documents import Document as LangchainDocument
from langchain.chains.retrieval_qa.base import RetrievalQA

from db.models import Document, DocumentChunk
from rag.embeddings import get_vector_store, get_llm
from rag.file_handlers import (
    process_pdf, 
    process_docx, 
    process_hwp, 
    prepare_chunks,
    save_uploaded_file,
    clean_text
)

def get_all_documents(db: Session):
    """모든 문서 조회"""
    return db.query(Document).all()

def safe_json_serializable(data):
    """JSON으로 직렬화할 수 있는 데이터만 반환"""
    try:
        # JSON 직렬화 시도
        json.dumps(data)
        return data
    except (TypeError, OverflowError):
        # 직렬화할 수 없는 경우 문자열로 변환
        if isinstance(data, dict):
            return {k: safe_json_serializable(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [safe_json_serializable(item) for item in data]
        else:
            return str(data)

def process_document(
    file: UploadFile, 
    user_id: int, 
    db: Session
) -> Tuple[int, int, str]:
    """문서 업로드 및 처리"""
    # 파일 확장자 확인
    file_extension = file.filename.split('.')[-1].lower()
    supported_extensions = ['pdf', 'hwp', 'hwpx', 'docx']
    
    if file_extension not in supported_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Only {', '.join(supported_extensions)} files are supported"
        )
    
    # 파일 저장
    file_path, timestamp = save_uploaded_file(file, file.filename)
    
    try:
        # 문서 DB에 저장
        db_document = Document(
            filename=file.filename, 
            upload_time=datetime.now(), 
            user_id=user_id
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        # 파일 형식에 따른 처리
        if file_extension == 'pdf':
            documents = process_pdf(file_path)
        elif file_extension == 'docx':
            documents = process_docx(file_path)
        elif file_extension in ['hwp', 'hwpx']:
            documents = process_hwp(file_path, file_extension)
        
        # 청크 준비
        chunks = prepare_chunks(documents, file.filename, timestamp)
        
        # 벡터 스토어에 문서 추가 시도
        try:
            vector_store = get_vector_store()
            vector_store.add_documents(chunks)
        except Exception as e:
            print(f"벡터 스토어 추가 오류: {str(e)}")
            # 대체 방법으로 한 번에 하나씩 청크 추가 시도
            try:
                vector_store = get_vector_store()
                for i, chunk in enumerate(chunks):
                    try:
                        # 청크 내용에서 문제가 되는 문자 제거
                        chunk.page_content = clean_text(chunk.page_content)
                        # 메타데이터 정리
                        chunk.metadata = safe_json_serializable(chunk.metadata)
                        vector_store.add_documents([chunk])
                        print(f"청크 {i+1}/{len(chunks)} 추가 성공")
                    except Exception as chunk_error:
                        print(f"청크 {i+1}/{len(chunks)} 추가 실패: {str(chunk_error)}")
                        continue
            except Exception as fallback_error:
                print(f"대체 방법 실패: {str(fallback_error)}")
                # 벡터 스토어 추가가 실패해도 계속 진행
        
        # DB에 청크 정보 저장
        for chunk in chunks:
            try:
                # 청크 내용 정리
                content = clean_text(chunk.page_content)
                # 메타데이터 정리
                metadata = safe_json_serializable(chunk.metadata)
                
                db_chunk = DocumentChunk(
                    document_id=db_document.id,
                    content=content,
                    meta=metadata
                )
                db.add(db_chunk)
            except Exception as chunk_db_error:
                print(f"청크 DB 저장 오류: {str(chunk_db_error)}")
                continue
        
        db.commit()
        
        return db_document.id, len(chunks), file_path
        
    except Exception as e:
        db.rollback()
        import traceback
        print(f"Error processing document: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

def query_documents(query: str) -> str:
    """문서 질의응답"""
    try:
        # 벡터 스토어 가져오기
        vector_store = get_vector_store()
        
        # LLM 가져오기
        llm = get_llm()
        
        # 검색 체인 생성
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=vector_store.as_retriever(search_kwargs={"k": 3})
        )
        
        # 질의 실행
        result = qa_chain({"query": query})
        
        return result["result"]
    except Exception as e:
        import traceback
        print(f"Error querying documents: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error querying documents: {str(e)}") 