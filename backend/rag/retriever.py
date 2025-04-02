



def get_reretriever(vector_store):
    """retriever 생성"""

    retriever = vector_store.as_retriever(
        # 검색 유형을 "mmr" 으로 설정
        search_type="mmr"
    )
    
    return retriever
