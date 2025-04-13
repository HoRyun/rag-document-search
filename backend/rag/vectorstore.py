# FAISS 관련 임포트 (주석 처리)
# import faiss
# from langchain_community.vectorstores import FAISS
# from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_postgres import PGVector
from langchain_core.documents import Document
import os
from sqlalchemy import text

from rag.embeddings import get_embeddings
from config.settings import DATABASE_URL

# FAISS 관련 함수들은 주석 처리
# def create_vector_store(documents, embeddings):
#     vector_store = FAISS(
#             embedding_function=embeddings,
#             # 임베딩 차원 수를 얻어 FAISS 인덱스 초기화
#             index=faiss.IndexFlatL2(len(embeddings.embed_query("hello world"))),
#             docstore=InMemoryDocstore(),
#             index_to_docstore_id={},
#         )
#
#     # DB 생성
#     vector_store = FAISS.from_documents(documents=documents, embedding=embeddings)
#     return vector_store
#
#
# def get_vector_store():
#     # 임베딩 모델 생성
#     embeddings=get_embeddings()
#
#
#     # 로컬에 저장된 vectorstore를 로드
#     vector_store = FAISS.load_local(
#         folder_path="db/faiss_db/",
#         index_name="faiss_index",
#         embeddings=embeddings,
#         allow_dangerous_deserialization=True,
#     )
#
#     print(vector_store)
#     print("--------------------------------")
#     print(vector_store.similarity_search("어떤 문서가 저장되어 있습니까?"))
#     print("--------------------------------")
#     print(len(vector_store.docstore._dict))
#     print("--------------------------------")
#     return vector_store

def save_to_vector_store(chunked_documents):
    # FAISS 벡터 저장소는 더 이상 사용하지 않음
    # vector_store=create_vector_store(chunked_documents, get_embeddings())
    # vector_store.save_local(folder_path="db/faiss_db", index_name="faiss_index")
    
    # PG Vector 저장소에만 저장
    try:
        save_to_pg_vector(chunked_documents)
    except Exception as e:
        print(f"PG Vector 저장 오류: {str(e)}")

def get_pg_vector_connection_string():
    """PGVector를 위한 연결 문자열을 제공합니다"""
    # 기본 URL 가져오기
    connection_string = DATABASE_URL
    
    # Docker 컨테이너 환경에서는 'db'를 사용, 로컬 개발 환경에서는 'localhost'를 사용
    if 'db:5432' in connection_string and not os.environ.get('DOCKER_ENV'):
        connection_string = connection_string.replace('db:5432', 'localhost:5432')
    
    # PGVector는 psycopg 접두사를 인식하지 못할 수 있으므로 표준 postgresql 접두사 사용
    # if 'postgresql+psycopg://' in connection_string:
    #     connection_string = connection_string.replace('postgresql+psycopg://', 'postgresql://')
    
    return connection_string

def get_pg_vector_store(): 
    """PostgreSQL 벡터 스토어를 가져옵니다."""
    connection_string = get_pg_vector_connection_string()
    collection_name = "document_chunks"
    
    embeddings = get_embeddings()
    
    # PGVector 스토어 생성
    try:
        vector_store = PGVector(
            embeddings=embeddings,
            collection_name=collection_name,
            connection=connection_string,
            use_jsonb=True,
            # --- 컬럼 매핑 추가 ---
            # id_field="id",          # Langchain 내부 ID -> DB 'id' 컬럼
            # content_field="content",  # Langchain 내부 content -> DB 'content' 컬럼
            # embedding_field="embedding",# Langchain 내부 embedding -> DB 'embedding' 컬럼
            # metadata_field="meta"      # Langchain 내부 metadata -> DB 'meta' 컬럼            

        )
        
        print(f"PGVector 스토어가 성공적으로 생성되었습니다: {collection_name}")
        return vector_store
    except Exception as e:
        print(f"PGVector 스토어 생성 오류: {str(e)}")
        # 오류 전파
        raise e

def update_embedding_vector_column():
    """embedding 컬럼의 데이터를 embedding_vector 컬럼으로 복사합니다"""
    from sqlalchemy import create_engine
    from config.settings import DATABASE_URL
    
    try:
        # 연결 설정
        engine = create_engine(DATABASE_URL)
        
        with engine.connect() as connection:
            # embedding 컬럼이 있는 청크를 찾아서 embedding_vector 컬럼에 복사
            result = connection.execute(text("""
                UPDATE document_chunks
                SET embedding_vector = embedding::vector
                WHERE embedding IS NOT NULL AND embedding_vector IS NULL
            """))
            connection.commit()
            
            count = result.rowcount
            print(f"{count}개의 청크에 embedding_vector 값이 업데이트되었습니다.")
            
        return True
    except Exception as e:
        print(f"embedding_vector 업데이트 오류: {str(e)}")
        return False

def save_to_pg_vector(documents):
    """문서를 PostgreSQL 벡터 스토어에 저장합니다."""
    from db.database import SessionLocal
    from db import crud, models
    
    db = SessionLocal()
    try:
        # 임베딩 모델
        embeddings = get_embeddings()
        
        # 각 청크에 대해
        for chunk in documents:
            # 해당 문서 찾기
            content = chunk.page_content
            metadata = chunk.metadata
            document_name = metadata.get("document_name", "")
            
            # 문서 ID 찾기
            document = db.query(models.Document).filter(models.Document.filename == document_name).first()
            
            if document:
                # 임베딩 생성
                embedding_vector = embeddings.embed_query(content)
                
                # DB에 저장
                crud.add_document_chunk(
                    db=db,
                    document_id=document.id,
                    content=content,
                    meta=metadata,
                    embedding=embedding_vector
                )
        
        # embedding 컬럼의 데이터를 embedding_vector 컬럼으로 복사 - 현재 문제를 발생시키는 코드이며, 필요하지 않은 코드이므로 주석처리.
        # update_embedding_vector_column()
                
        print(f"총 {len(documents)}개의 청크가 PostgreSQL에 저장되었습니다.")
    except Exception as e:
        print(f"PostgreSQL 저장 오류: {str(e)}")
        raise e
    finally:
        db.close()

   
