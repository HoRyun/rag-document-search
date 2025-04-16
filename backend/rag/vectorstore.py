from rag.embeddings import get_embeddings

def save_to_vector_store(chunked_documents):

    # PG Vector 저장소에만 저장
    try:
        save_to_pg_vector(chunked_documents)
    except Exception as e:
        print(f"PG Vector 저장 오류: {str(e)}")


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
                
        print(f"총 {len(documents)}개의 청크가 PostgreSQL에 저장되었습니다.")
    except Exception as e:
        print(f"PostgreSQL 저장 오류: {str(e)}")
        raise e
    finally:
        db.close()

   
