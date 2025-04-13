from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document
import numpy as np
from sqlalchemy import text
from .embeddings import get_embeddings
import os


def format_docs(docs):
    # 모든 문서를 하나의 문자열로 결합
    return "\n\n".join(doc.page_content for doc in docs)

def get_llms_answer(query: str) -> str:
    """LLM 모델 함수"""

    # 프롬프트를 생성합니다.
    prompt = PromptTemplate.from_template(
        """
        You are an assistant for question-answering tasks. 
        Use the following pieces of retrieved context to answer the question. 
        If you don't know the answer, just say that you don't know. 
        Answer in Korean.
    <Question> {question} </Question>
    <Context> {context} </Context>
    Answer:
    """
    )

    # OpenAI 모델 사용
    llm = ChatOpenAI(
    temperature=0.2,
    max_tokens=2048,
    model_name="gpt-4o-mini",)

    # 데이터베이스에서 MMR 알고리즘을 사용하여 관련 문서 검색
    # 1. 임베딩 모델 가져오기
    embeddings_model = get_embeddings()
    
    # 2. 사용자 쿼리를 임베딩 벡터로 변환
    query_embedding = embeddings_model.embed_query(query)
    query_embedding_array = np.array(query_embedding)
    
    # 3. 직접 SQL 쿼리로 문서 가져오기 (ORM 대신)
    # 문서 목록을 저장할 변수
    docs = []
    
    try:
        # 직접 raw connection 사용
        from sqlalchemy import create_engine
        from config.settings import DATABASE_URL
        
        # 데이터베이스 URL 수정 (필요한 경우)
        modified_url = DATABASE_URL
        
        # Docker 컨테이너 환경에서는 'db'를 사용, 로컬 개발 환경에서는 'localhost'를 사용
        # getaddrinfo 오류 방지를 위한 조치
        if 'db:5432' in modified_url and not os.environ.get('DOCKER_ENV'):
            modified_url = modified_url.replace('db:5432', 'localhost:5432')
        
        if 'postgresql' in modified_url and not modified_url.startswith('postgresql+psycopg://'):
            modified_url = modified_url.replace('postgresql://', 'postgresql+psycopg://')
        
        print(f"Database connection URL: {modified_url}")
        
        # autocommit=True로 엔진 생성
        engine = create_engine(modified_url, pool_pre_ping=True)
        
        # connection 직접 가져오기
        with engine.connect() as connection:
            # 4. 모든 문서 가져오기 (제한적인 수)
            candidates_query = """
            SELECT 
                id,
                document_id,
                content,
                meta,
                embedding
            FROM 
                document_chunks
            LIMIT 100
            """
            
            # 쿼리 실행 및 결과 즉시 변환
            result = connection.execute(text(candidates_query))
            candidates = [dict(row._mapping) for row in result]  # 딕셔너리로 변환
            
            # 5. 파이썬에서 유사도 계산 및 MMR 알고리즘 구현
            candidate_docs = []
            
            # 각 문서와 쿼리 임베딩 사이의 코사인 유사도 계산
            for row in candidates:
                # None 체크 및 임베딩 타입 확인
                if row['embedding'] is None:
                    continue
                
                # 임베딩 데이터 변환 - PostgreSQL의 Vector 타입이 다양한 형태로 반환될 수 있음
                try:
                    # 리스트 형태로 변환 시도
                    if isinstance(row['embedding'], str):
                        # 문자열 형태로 반환된 경우 파싱
                        import re
                        vector_str = row['embedding']
                        vector_str = vector_str.replace('[', '').replace(']', '')
                        doc_embedding = np.array([float(x) for x in re.split(r',\s*', vector_str)])
                    elif isinstance(row['embedding'], list):
                        # 이미 리스트 형태면 그대로 변환
                        doc_embedding = np.array(row['embedding'])
                    else:
                        # 기타 형식은 직접 변환 시도
                        doc_embedding = np.array(row['embedding'])
                    
                    # 임베딩 벡터가 유효한지 확인 (차원과 null 값 체크)
                    if doc_embedding is None or len(doc_embedding) != len(query_embedding_array):
                        print(f"무효한 임베딩 벡터 발견: {type(row['embedding'])}, 길이: {len(doc_embedding) if doc_embedding is not None else 'None'}")
                        continue
                    
                    # 코사인 유사도 계산
                    norm_query = np.linalg.norm(query_embedding_array)
                    norm_doc = np.linalg.norm(doc_embedding)
                    
                    # 0으로 나누기 방지
                    if norm_query > 0 and norm_doc > 0:
                        similarity = np.dot(query_embedding_array, doc_embedding) / (norm_query * norm_doc)
                    else:
                        similarity = 0
                    
                    candidate_docs.append({
                        "id": row['id'],
                        "document_id": row['document_id'],
                        "content": row['content'],
                        "meta": row['meta'],
                        "embedding": doc_embedding,
                        "similarity": similarity
                    })
                except Exception as e:
                    print(f"임베딩 처리 오류: {str(e)} - 데이터 타입: {type(row['embedding'])}")
                    continue
            
            # 6. MMR 알고리즘 구현
            selected_docs = []
            lambda_val = 0.5  # MMR 가중치 - 관련성과 다양성 균형
            max_documents = 5  # 최종 반환 문서 수
            
            # 유사도 기준으로 정렬
            candidate_docs = sorted(candidate_docs, key=lambda x: x["similarity"], reverse=True)
            
            while len(selected_docs) < max_documents and candidate_docs:
                # MMR 점수 계산
                mmr_scores = {}
                for i, doc in enumerate(candidate_docs):
                    if len(selected_docs) == 0:
                        # 첫 번째 문서는 유사도가 가장 높은 것 선택
                        mmr_scores[i] = doc["similarity"]
                    else:
                        # 이미 선택된 문서와의 최대 유사도 계산
                        max_sim_with_selected = 0
                        for selected_doc in selected_docs:
                            # 코사인 유사도 계산
                            sim = np.dot(doc["embedding"], selected_doc["embedding"]) / (
                                np.linalg.norm(doc["embedding"]) * np.linalg.norm(selected_doc["embedding"])
                            )
                            max_sim_with_selected = max(max_sim_with_selected, sim)
                        
                        # MMR 점수 계산
                        mmr_scores[i] = lambda_val * doc["similarity"] - (1 - lambda_val) * max_sim_with_selected
                
                # 가장 높은 MMR 점수를 가진 문서 선택
                if mmr_scores:
                    selected_idx = max(mmr_scores, key=mmr_scores.get)
                    selected_docs.append(candidate_docs[selected_idx])
                    candidate_docs.pop(selected_idx)
                else:
                    break
            
            # 7. 결과를 Document 객체 리스트로 변환
            docs = []
            for doc in selected_docs:
                doc_obj = Document(
                    page_content=doc["content"],
                    metadata=doc["meta"] if doc["meta"] else {}
                )
                docs.append(doc_obj)
    
    except Exception as e:
        import traceback
        print(f"문서 검색 오류: {str(e)}")
        print(f"오류 상세 내용: {traceback.format_exc()}")
        # 오류 발생 시 빈 문서 리스트 반환
        docs = []
   
    # 문서를 문자열로 변환
    formatted_docs = format_docs(docs)

    # 단계 8: 체인(Chain) 생성
    chain = (
        {"question": RunnablePassthrough(), "context": lambda _: formatted_docs}
        | prompt
        | llm
        | StrOutputParser()
    )

    # 체인 실행(Run Chain)
    # 문서에 대한 질의를 입력하고, 답변을 출력합니다.
    question = query
    response = chain.invoke(question)
   
    return response

