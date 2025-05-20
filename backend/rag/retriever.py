import traceback
from langchain_core.documents import Document
import numpy as np
from sqlalchemy import text

def search_similarity(embed_query_data, engine):
    """db에서 유사도 검색 수행"""
# <SQL 쿼리를 날려 사용자 쿼리와 유사한 임베딩 청크 가져오기>
    try:
        # 문서 목록을 저장할 변수
        docs = []
        # connection 직접 가져오기
        with engine.connect() as connection:
            # 데이터베이스에서 직접 유사도 계산 및 상위 문서 가져오기
            # 쿼리 임베딩을 문자열로 변환
            query_embedding_str = str(embed_query_data)
            query_embedding_str = query_embedding_str.replace("'", "\"")  # 잠재적인 SQL 인젝션 방지
            
            # 상위 유사도 문서 검색 쿼리
            # 1. 유효한 임베딩 벡터만 고려 (NULL 아님)
            # 2. 코사인 유사도 계산: 1 - (벡터1 <=> 벡터2)
            # 3. 유사도 기준으로 정렬하여 상위 N개 가져오기
            top_n = 20  # 후보 문서 수
            
            # PostgreSQL에서는 쿼리 매개변수를 직접 쿼리에 포함
            similarity_query = text(    
            f"""SELECT
                    id,
                    document_id,
                    content,
                    meta,
                    embedding,
                    1 - (embedding <=> CAST('{query_embedding_str}' AS vector)) AS similarity
                FROM 
                    document_chunks
                WHERE 
                    embedding IS NOT NULL
                    AND vector_dims(embedding) > 0
                ORDER BY 
                    embedding <=> CAST('{query_embedding_str}' AS vector)
                LIMIT :top_n
                """)           
            # 쿼리 실행 (top_n만 파라미터로 전달)
            result = connection.execute(
                similarity_query, 
                {"top_n": top_n}
            )

            candidates = [dict(row._mapping) for row in result]
            print(f"데이터베이스에서 {len(candidates)}개의 후보 문서를 가져왔습니다.")

            # 후보 문서가 없으면 빈 리스트 반환
            if not candidates:
                print("유사한 문서를 찾을 수 없습니다.")
                docs = []
                return (docs)
            
        candidate_docs = []
        # 각 문서의 임베딩을 numpy 배열로 변환
        for row in candidates:
            try:
                # 임베딩이 문자열인지 확인 후 변환
                if isinstance(row['embedding'], str):
                    import ast
                    try:
                        # 문자열 형태의 임베딩을 배열로 변환 시도
                        embedding_data = ast.literal_eval(row['embedding'])
                        doc_embedding = np.array(embedding_data, dtype=float)
                    except (ValueError, SyntaxError) as e:
                        print(f"임베딩 문자열 파싱 오류: {str(e)} - 문서 ID: {row['id']}")
                        continue  # 이 문서는 건너뜁니다
                else:
                    doc_embedding = np.array(row['embedding'])

                # 임베딩 벡터 검증
                if len(doc_embedding) == 0:
                    print(f"빈 임베딩 벡터 - 문서 ID: {row['id']}")
                    continue
                
                candidate_docs.append({
                    "id": row['id'],
                    "document_id": row['document_id'],
                    "content": row['content'],
                    "meta": row['meta'],
                    "embedding": doc_embedding,
                    "similarity": row['similarity']
                })
            except Exception as e:
                print(f"임베딩 변환 오류: {str(e)} - 문서 ID: {row['id']}")
                continue            

        return (candidate_docs)
    except Exception as e:
        print(f"문서 검색 오류: {str(e)}")
        print(f"오류 상세 내용: {traceback.format_exc()}")
        # 오류 발생 시 빈 문서 리스트 반환
        docs = []
        return (docs)                 # 쿼리의 결과는 candidates 리스트에 저장된다.


def do_mmr(candidate_docs):
    """MMR 알고리즘 구현"""
    import numpy as np

    selected_docs = []
    lambda_val = 0.5  # MMR 가중치 - 관련성과 다양성 균형
    max_documents = 3  # 최종 반환 문서 수


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
                    # 코사인 유사도 계산 - 0으로 나누기 예외 처리
                    try:
                        # 디버깅: 임베딩 타입 확인 -  디버깅 시에만 주석 해제하기.
                        # print(f"doc embedding type: {type(doc['embedding'])}")
                        # print(f"doc embedding sample: {str(doc['embedding'])[:100]}")
                        # print(f"selected_doc embedding type: {type(selected_doc['embedding'])}")
                        # print(f"selected_doc embedding sample: {str(selected_doc['embedding'])[:100]}")

                        # 임베딩이 문자열인 경우 배열로 변환 시도
                        if isinstance(doc["embedding"], str):
                            import ast
                            try:
                                doc["embedding"] = np.array(ast.literal_eval(doc["embedding"]), dtype=float)
                            except:
                                # 문자열을 배열로 변환할 수 없는 경우 빈 배열 사용
                                doc["embedding"] = np.array([], dtype=float)

                        if isinstance(selected_doc["embedding"], str):
                            import ast
                            try:
                                selected_doc["embedding"] = np.array(ast.literal_eval(selected_doc["embedding"]), dtype=float)
                            except:
                                # 문자열을 배열로 변환할 수 없는 경우 빈 배열 사용
                                selected_doc["embedding"] = np.array([], dtype=float)

                        # 빈 배열이거나 모양이 맞지 않는 경우 건너뛰기
                        if len(doc["embedding"]) == 0 or len(selected_doc["embedding"]) == 0:
                            print("임베딩 벡터가 비어 있어 유사도 계산을 건너뜁니다.")
                            sim = 0
                            continue
                        
                        doc_norm = np.linalg.norm(doc["embedding"])
                        selected_norm = np.linalg.norm(selected_doc["embedding"])

                        # 0으로 나누기 방지
                        if doc_norm > 0 and selected_norm > 0:
                            sim = np.dot(doc["embedding"], selected_doc["embedding"]) / (doc_norm * selected_norm)
                        else:
                            sim = 0

                        max_sim_with_selected = max(max_sim_with_selected, sim)
                    except Exception as e:
                        print(f"유사도 계산 오류: {str(e)}")
                        # 오류 발생 시 기본값 사용
                        sim = 0

                # MMR 점수 계산
                mmr_scores[i] = lambda_val * doc["similarity"] - (1 - lambda_val) * max_sim_with_selected
        # 가장 높은 MMR 점수를 가진 문서 선택
        if mmr_scores:
            try:
                selected_idx = max(mmr_scores, key=mmr_scores.get)
                selected_docs.append(candidate_docs[selected_idx])
                candidate_docs.pop(selected_idx)
            except (ValueError, KeyError, IndexError) as e:
                print(f"문서 선택 오류: {str(e)}")
                break  # 문서 선택 오류 시 루프 종료
        else:
            break

    # 7. 결과를 Document 객체 리스트로 변환
    docs = []
    for doc in selected_docs:
        try:
            # metadata가 None인 경우 빈 딕셔너리로 대체
            metadata = doc["meta"] if doc["meta"] is not None else {}
            
            doc_obj = Document(
                page_content=doc["content"] or "",  # content가 None인 경우 빈 문자열로 대체
                metadata=metadata
            )
            docs.append(doc_obj)
        except Exception as e:
            print(f"Document 객체 생성 오류: {str(e)} - 문서 ID: {doc.get('id', 'unknown')}")
            continue            
    
    return docs
