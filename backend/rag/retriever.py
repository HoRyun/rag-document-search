import traceback
from langchain_core.documents import Document
import numpy as np
from sqlalchemy import text

def search_similarity(user_id, embed_query_data, engine):
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
                    dc.id,
                    dc.document_id,
                    dc.content,
                    dc.embedding,
                    1 - (dc.embedding <=> CAST('{query_embedding_str}' AS vector)) AS similarity
                FROM 
                    document_chunks dc
                JOIN
                    documents d ON dc.document_id = d.id
                    
                WHERE 
                    d.user_id = :user_id
                    AND dc.embedding IS NOT NULL
                    AND vector_dims(dc.embedding) > 0
                ORDER BY 
                    dc.embedding <=> CAST('{query_embedding_str}' AS vector)
                LIMIT :top_n
                """)           
            # 쿼리 실행 (user_id, top_n을 파라미터로 전달)
            result = connection.execute(
                similarity_query, 
                {"top_n": top_n,
                 "user_id": user_id
                }
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


def do_mmr(embed_query_data, candidate_docs):
    """MMR 알고리즘 수행."""
    import numpy as np
    
    selected_docs = []
    lambda_val = 0.9  # MMR 가중치 - 관련성과 다양성 균형
    max_documents = 5  # 최종 반환 문서 수
    min_similarity = 0.4  # 최소 유사도 기준값

    # 쿼리 임베딩이 문자열인 경우 numpy 배열로 변환
    if isinstance(embed_query_data, str):
        import ast
        try:
            embed_query_data = np.array(ast.literal_eval(embed_query_data), dtype=float)
        except:
            # 변환 실패 시 빈 배열 사용
            embed_query_data = np.array([], dtype=float)
    elif not isinstance(embed_query_data, np.ndarray):
        # 이미 numpy 배열이 아니면 변환
        embed_query_data = np.array(embed_query_data, dtype=float)
        
    query_norm = np.linalg.norm(embed_query_data)

    # 각 후보 문서에 대해 사용자 쿼리와의 유사도 직접 계산
    for doc in candidate_docs:
        # 임베딩 벡터 확인
        if len(embed_query_data) > 0 and query_norm > 0 and len(doc["embedding"]) > 0:
            doc_norm = np.linalg.norm(doc["embedding"])
            if doc_norm > 0:
                # 코사인 유사도 계산
                query_similarity = np.dot(embed_query_data, doc["embedding"]) / (query_norm * doc_norm)
                # 기존의 유사도를 새로 계산한 값으로 업데이트
                doc["similarity"] = query_similarity

    # 최소 유사도 기준값(min_similarity)으로 후보 문서 필터링
    filtered_docs = [doc for doc in candidate_docs if doc["similarity"] >= min_similarity]
    
    # 필터링 결과 로깅
    print(f"전체 후보 문서: {len(candidate_docs)}개, 필터링 후 문서: {len(filtered_docs)}개 (최소 유사도: {min_similarity})")
    
    # 필터링된 문서가 없으면 빈 리스트 반환
    if not filtered_docs:
        print(f"유사도 {min_similarity} 이상의 문서가 없습니다.")
        return []
        
    # 유사도 기준으로 정렬 (필터링된 문서만 사용)
    filtered_docs = sorted(filtered_docs, key=lambda x: x["similarity"], reverse=True)

    while len(selected_docs) < max_documents and filtered_docs:
        # MMR 점수 계산
        mmr_scores = {}
        for i, doc in enumerate(filtered_docs):
            if len(selected_docs) == 0:
                # 첫 번째 문서는 유사도가 가장 높은 것 선택
                mmr_scores[i] = doc["similarity"]
            else:
                # 이미 선택된 문서와의 최대 유사도 계산
                max_sim_with_selected = 0
                for selected_doc in selected_docs:
                    # 코사인 유사도 계산 - 0으로 나누기 예외 처리
                    try:
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
                selected_docs.append(filtered_docs[selected_idx])
                filtered_docs.pop(selected_idx)
            except (ValueError, KeyError, IndexError) as e:
                print(f"문서 선택 오류: {str(e)}")
                break  # 문서 선택 오류 시 루프 종료
        else:
            break

    # 7. 결과를 Document 객체 리스트로 변환
    docs = []
    for doc in selected_docs:
        try:
            # meta 필드 참조 대신 빈 딕셔너리 사용
            metadata = {}
            
            doc_obj = Document(
                page_content=doc["content"] or "",  # content가 None인 경우 빈 문자열로 대체
                metadata=metadata
            )
            docs.append(doc_obj)
        except Exception as e:
            print(f"Document 객체 생성 오류: {str(e)} - 문서 ID: {doc.get('id', 'unknown')}")
            continue            
    
    return docs
