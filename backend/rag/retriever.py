



def get_retriever(vector_store):
    """retriever 생성"""

    retriever = vector_store.as_retriever(
        # 검색 유형을 "mmr" 으로 설정
        search_type="mmr"
    )

    # --- 추가된 코드 시작 ---
    print("--- 디버깅 정보 ---")
    print(f"Retriever 내부 vector_store: {retriever.vectorstore}")
    if hasattr(retriever.vectorstore, 'embeddings'):
        print(f"Retriever 사용 임베딩 함수: {retriever.vectorstore.embeddings}")
        if hasattr(retriever.vectorstore.embeddings, 'model'):
            print(f"Retriever 사용 임베딩 모델: {retriever.vectorstore.embeddings.model}")
        else:
            print("Retriever 임베딩 함수에 'model' 속성이 없습니다.")
    else:
        print("Retriever vector_store에 'embeddings' 속성이 없습니다.")
    print("--- 디버깅 정보 끝 ---")
    # --- 추가된 코드 끝 ---

    # 관련 문서를 검색
    docs = retriever.invoke("2018년에 진행했던 보고서에서 누가 책임을 맡았었더라?")

    for doc in docs:
        print(doc.page_content)
        print("=========================================================")    
    
    return retriever
