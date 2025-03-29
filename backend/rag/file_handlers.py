import os
import tempfile
import shutil
import subprocess
import re
from datetime import datetime
from typing import List

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
import docx2txt

from config.settings import UPLOAD_DIR

def clean_text(text):
    """텍스트에서 NULL 문자 및 기타 문제가 될 수 있는 특수 문자 제거"""
    # NULL 문자 제거
    text = text.replace('\x00', '')
    
    # 제어 문자 제거 (탭, 줄바꿈, 캐리지 리턴은 유지)
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    
    return text

def process_pdf(file_path):
    """PDF 파일 처리"""
    print("Processing PDF file...")
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    
    # PDF 문서 내용 정리
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)
        
    print(f"Extracted {len(documents)} pages from PDF")
    return documents

def process_docx(file_path):
    """Word 문서 처리"""
    print("Processing DOCX file...")
    text = docx2txt.process(file_path)
    
    # 텍스트 정리
    text = clean_text(text)
    
    # TextLoader를 사용하기 위해 임시 텍스트 파일 생성
    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp:
        temp.write(text)
        temp_path = temp.name
    
    try:
        loader = TextLoader(temp_path)
        documents = loader.load()
        print(f"Created {len(documents)} document(s) from DOCX")
        return documents
    finally:
        os.unlink(temp_path)  # 임시 파일 삭제

def process_hwp(file_path, file_extension):
    """HWP/HWPX 문서 처리"""
    print(f"Processing {file_extension.upper()} file...")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp:
        temp_path = temp.name
    
    try:
        print(f"Running hwp5txt on {file_path} with output to {temp_path}")
        subprocess.run(['hwp5txt', file_path, '--output', temp_path], check=True)
        
        # 텍스트 파일 읽기 및 정리
        with open(temp_path, 'r', encoding='utf-8') as f:
            text = f.read()
        
        # 텍스트 정리
        text = clean_text(text)
        
        # 정리된 텍스트로 파일 다시 쓰기
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(text)
        
        loader = TextLoader(temp_path, encoding='utf-8')
        documents = loader.load()
        print(f"Created {len(documents)} document(s) from {file_extension.upper()}")
        return documents
    except Exception as e:
        print(f"Error processing {file_extension.upper()} file: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise
    finally:
        os.unlink(temp_path)  # 임시 파일 삭제

def prepare_chunks(documents, file_name, timestamp):
    """문서를 청크로 분할하고 메타데이터 추가"""
    print("Splitting text into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks from document")
    
    # 메타데이터 추가 및 텍스트 정리
    for chunk in chunks:
        # NULL 문자 및 기타 문제가 될 수 있는 문자 제거
        chunk.page_content = clean_text(chunk.page_content)
        chunk.metadata["source"] = file_name
        chunk.metadata["upload_time"] = timestamp
    
    return chunks

def save_uploaded_file(file, filename):
    """업로드된 파일 저장"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(UPLOAD_DIR, f"{timestamp}_{filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return file_path, timestamp 