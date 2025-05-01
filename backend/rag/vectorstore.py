from rag.embeddings import get_embeddings



def save_to_vector_store(documents):
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
            
            # 문서 ID 찾기. 문서 이름이 db에 존재하면 해당 문서의 레코드 반환.
            document = db.query(models.Document).filter(models.Document.filename == document_name).first()
            
            if document:
                # 메타데이터에서 필요한 정보 추출
                metadata_text = f"<The name of this document>{metadata.get('document_name', '')}</The name of this document> <The path of this document>{metadata.get('document_path', '')}</The path of this document>"
                
                # 콘텐츠와 메타데이터 결합
                combined_text = f"{content} {metadata_text}"
                
                # 결합된 텍스트 임베딩
                embedding_vector = embeddings.embed_query(combined_text)
            
                
                # DB에 저장
                crud.add_document_chunk(
                    db=db,
                    document_id=document.id,
                    content=content,
                    meta=metadata,
                    embedding=embedding_vector
                )
                
        print(f"총 {len(documents)}개의 청크가 PostgreSQL에 저장되었습니다.")
        return document.id
    except Exception as e:
        print(f"PostgreSQL 저장 오류: {str(e)}")
        raise e
    finally:
        db.close()


def manually_create_vector_extension(engine):
    """pgvector 익스텐션을 수동으로 생성합니다"""
    from sqlalchemy import text
    from config.settings import DATABASE_URL
    import os
    try:
        # 클라이언트 인코딩 옵션 추가
        modified_url = DATABASE_URL
        
        # Docker 컨테이너 환경에서는 'db'를 사용, 로컬 개발 환경에서는 'localhost'를 사용
        # getaddrinfo 오류 방지를 위한 조치
        if 'db:5432' in modified_url and not os.environ.get('DOCKER_ENV'):
            modified_url = modified_url.replace('db:5432', 'localhost:5432')
        
        if 'postgresql' in modified_url and not modified_url.startswith('postgresql+psycopg://'):
            modified_url = modified_url.replace('postgresql://', 'postgresql+psycopg://')
            
        if '?' in modified_url:
            modified_url = f"{modified_url}&client_encoding=utf8"
        else:
            modified_url = f"{modified_url}?client_encoding=utf8"
        
        print(f"Vector extension 연결 URL: {modified_url}")
                
        with engine.connect() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            connection.commit()
        return True
    except Exception as e:
        print(f"수동 벡터 확장 생성 오류: {str(e)}")
        return False