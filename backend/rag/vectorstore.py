import faiss
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore

from rag.embeddings import get_embeddings

def create_vector_store(documents, embeddings):
    vector_store = FAISS(
            embedding_function=embeddings,
            # 임베딩 차원 수를 얻어 FAISS 인덱스 초기화
            index=faiss.IndexFlatL2(len(embeddings.embed_query("hello world"))),
            docstore=InMemoryDocstore(),
            index_to_docstore_id={},
        )

    # DB 생성
    vector_store = FAISS.from_documents(documents=documents, embedding=embeddings)
    return vector_store


def get_vector_store():
    # 임베딩 모델 생성
    embeddings=get_embeddings()


    # 로컬에 저장된 vectorstore를 로드
    vector_store = FAISS.load_local(
        folder_path="db/faiss_db/",
        index_name="faiss_index",
        embeddings=embeddings,
        allow_dangerous_deserialization=True,
    )

    print(vector_store)
    print("--------------------------------")
    print(vector_store.similarity_search("어떤 문서가 저장되어 있습니까?"))
    print("--------------------------------")
    print(len(vector_store.docstore._dict))
    print("--------------------------------")
    return vector_store

def save_to_vector_store(chunked_documents):
    # FAISS 벡터 저장소 생성
    vector_store=create_vector_store(chunked_documents, get_embeddings())
    
    # 로컬 disk에 저장. index_name: vectorstore의 이름.
    vector_store.save_local(folder_path="db/faiss_db", index_name="faiss_index")  

   
