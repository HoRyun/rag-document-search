import os
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_text_splitters import CharacterTextSplitter


def chunk_documents(documents, filepath, file_name):
    """문서 청킹"""
    print("Splitting text into chunks...")

    # CharacterTextSplitter를 사용하여 텍스트를 청크(chunk)로 분할하는 코드
    text_splitter = RecursiveCharacterTextSplitter(
        # 분할된 텍스트 청크의 최대 크기를 지정합니다 (문자 수).
        chunk_size=600,
        # 분할된 텍스트 청크 간의 중복되는 문자 수를 지정합니다.
        chunk_overlap=250,
        # 텍스트의 길이를 계산하는 함수를 지정합니다.
        length_function=len,
        # 구분자를 정규 표현식으로 처리할지 여부를 지정합니다.
        is_separator_regex=False,
    )
    
    metadatas = [
        {
            "document_name": file_name,
            "document_path": filepath,
        }
    ]  # 문서에 대한 메타데이터 리스트를 정의합니다.

    chunked_documents = []  # 모든 청크를 저장할 리스트
    total_chunks = 0  # 총 청크 수를 세기 위한 변수
    
    for i, document in enumerate(documents):
        chunks = text_splitter.create_documents(
            [
                document
            ],  # 분할할 텍스트 데이터를 리스트로 전달합니다.
            metadatas=metadatas,  # 각 문서에 해당하는 메타데이터를 전달합니다.
        )
        chunked_documents.extend(chunks)  # 생성된 청크를 전체 청크 리스트에 추가
        total_chunks += len(chunks)  # 총 청크 수 누적
        print(f"Page {i+1}: split into {len(chunks)} chunks")

    # text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    # chunks = text_splitter.split_documents(documents)
    

    # 서버 로그에 출력
    print(f"Total {total_chunks} chunks created from {len(documents)} pages of a single document")
    return chunked_documents
