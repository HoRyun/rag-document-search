from datetime import datetime
import traceback

# fastapi 관련
from fastapi import HTTPException

# db 관련 
from sqlalchemy.orm import Session
from db import crud
from db.models import Document

# 함수 불러오기
from rag.embeddings import embed_query
from rag.vectorstore import save_to_vector_store
from rag.retriever import search_similarity, do_mmr
from rag.file_load import (
    load_pdf, 
    load_docx, 
    load_hwp, 
)
from rag.chunking import chunk_documents

# from fast_api.endpoints.documents import stop_debugger





def get_all_documents(db: Session):
    """모든 문서 조회"""
    return db.query(Document).all()


async def process_document(
    file_name: str,
    file_path: str,
    file_content: bytes,
    user_id: int, 
    db: Session,
    s3_key: str
) -> int:
    """문서 업로드 및 처리"""

    # 1. 업로드 된 파일의 형식을 확인한다.
    # 파일 확장자 추출
    file_extension = file_name.split('.')[-1].lower()

    # 지원되는 파일 형식 확인
    if file_extension not in ['pdf', 'docx', 'hwp', 'hwpx']:
        raise HTTPException(
            status_code=400, 
            detail="지원되지 않는 파일 형식입니다. PDF, DOCX, HWP 또는 HWPX 파일만 업로드 가능합니다."
        )
    
    # 파일의 경로 # 아래 코드는 삭제
    # file_path = path+file.filename

    # 파일의 이름 추출
    # file_name = os.path.basename(file_path)




    try:
        

        # 2. 업로드 된 파일의 정보를 db에 저장한다.
        # 업로드 된 파일의 이름, 업로드 시간, 사용자 아이디를 DB의 documents 테이블에 저장.
        # DB의 documents 테이블에 문서 정보 저장. # 이 코드는 이 위치에 있어야 함.
        
        # 문서 정보 저장 중 오류 발생 시 예외 처리
        try:
            if crud.get_file_info_by_filename(db, file_name):
                # 만약 이 파일이 db에 이미 존재한다면 이 파일을 또 저장하지 않는다.
                pass
            else:
                crud.add_documents(db, file_name, s3_key, datetime.now(), user_id)
        except Exception as e:
            print(f"Error adding documents: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Error adding documents: {str(e)}")



        # 3. 파일 형식에 따라 문서 로드
        # 파일을 읽어 문자열 리스트로 반환하는 작업을 한다.
        if file_extension == 'pdf':
            documents = await load_pdf(file_content) # file 대신 file_content를 매개변수로 전달
        elif file_extension == 'docx':
            documents = await load_docx(file_content) # file 대신 file_content를 매개변수로 전달
        elif file_extension in ['hwp', 'hwpx']:
            documents = await load_hwp(file_content, file_extension)



        # 4. 문서 청킹
        # 문자열 리스트화 된 문서를 조각으로 나눈다.
        chunked_documents = chunk_documents(documents, file_path, file_name)
        # 4. 문서 청킹


        # 5. 벡터 스토어에 청크들을 저장
        # 청크들을 임베딩하여 벡터 스토어에 저장한다.
        try:
            # chunked_documents를 db로 보낼때 비동기 처리를 하면 됨.
            # chunked_documents는 문서에 따라 여러 개의 데이터가 들어가니까 비동기 처리를 해야 함.
            document_id = await save_to_vector_store(db, chunked_documents, file_name, file_path)
            print(f"Document {file_name} uploaded and processed successfully")
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


def process_query(user_id, query: str, engine) -> str:
    """사용자의 쿼리를 처리"""
    try:
        # 쿼리 임베딩
        embed_query_data = embed_query(query)
        # 검색 결과 가져오기
        search_similarity_result = search_similarity(user_id, embed_query_data, engine)
        
        # MMR 알고리즘 수행
        docs = do_mmr(embed_query_data, search_similarity_result)
        # stop_debugger()

        return docs
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        print(traceback.format_exc())
        # 오류 발생 시 사용자 친화적인 메시지 반환
        return f"처리 중 오류가 발생했습니다. 관리자에게 문의하세요. 오류 정보: {str(e)[:100]}..." 
    

# 디버깅 stop 시 다음 코드 강제 실행 불가하도록 하는 함수.
def stop_debugger():
    """q누르면 루프를 강제 종료한다."""
    while 1:
        # 키 입력 받기
        key = input("프로그램이 중단되었습니다. 끝내려면 'q', 계속하려면 'g'.")
        # q 키를 누르면 예외를 발생시켜 프로그램을 강제 종료
        if key.lower() == 'q':
            raise Exception("사용자에 의해 강제 종료되었습니다.")
        elif key.lower() == 'g':
            break