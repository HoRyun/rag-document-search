

def get_embeddings():
    """임베딩 모델 함수."""
    from langchain_openai import OpenAIEmbeddings
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    return embeddings



def manually_create_vector_extension(engine):
    """pgvector 익스텐션을 수동으로 생성합니다"""
    """pgvector 익스텐션은 db에 한 번 생성되면 데이터베이스가 삭제될 때까지 유지되며
    해당 함수의 로직은 안전하게 애플리케이션을 초기화하기 위한 일반적인 패턴입니다."""
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
            # 벡터 익스텐션 생성 쿼리
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            connection.commit()
        return True
    except Exception as e:
        print(f"수동 벡터 확장 생성 오류: {str(e)}")
        return False


def embed_query(query: str):
    """사용자 쿼리를 임베딩 벡터로 변환"""
    embeddings_model = get_embeddings()
    embeded_query = embeddings_model.embed_query(query)
    return embeded_query
