# 텍스트를 추출한다. 
# RAG 프로세스 중 문서 로드 단계.

import os
import tempfile
import subprocess
import re

from langchain_community.document_loaders import PyPDFLoader, TextLoader
import docx2txt

from io import BytesIO
from PyPDF2 import PdfReader

def clean_text(text):
    """텍스트에서 NULL 문자 및 기타 문제가 될 수 있는 특수 문자 제거"""
    # NULL 문자 제거
    text = text.replace('\x00', '')
    
    # 제어 문자 제거 (탭, 줄바꿈, 캐리지 리턴은 유지)
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    
    return text

async def load_pdf(file):
    """PDF 파일 사전 처리"""
    print("Loading PDF file...")

    # 파일 객체를 메모리에 로드
    pdf_content = await file.read()
    
    # BytesIO를 사용하여 메모리 내 파일 객체 생성(process_pdf 함수 종료 시 해당 파일 분에 한해 메모리 해제됨)
    pdf_file = BytesIO(pdf_content)
    
    # PyPDFLoader 대신 PyPDFReader 사용
    reader = PdfReader(pdf_file)
    documents = []
    for page in reader.pages:
        text = page.extract_text()
        text = clean_text(text)
        documents.append(text)
 

        
    print(f"Extracted {len(documents)} pages from PDF")
    return documents



async def load_docx(file):
    """Word 문서 처리"""
    print("Loading DOCX file...")
    
    # 파일 객체를 메모리에 로드
    docx_content = await file.read()
    
    # 임시 파일 생성
    with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp:
        temp.write(docx_content)
        temp_path = temp.name
    
    try:
        # docx2txt 패키지를 사용하여 문서 로드
        text = docx2txt.process(temp_path)
        
        # 결과를 PDF와 같은 형식으로 변환
        documents = []
        text = clean_text(text)
        documents.append(text)
        
        print(f"추출된 Word 문서 내용: {len(documents)} 페이지")
        return documents
    except Exception as e:
        print(f"DOCX 파일 처리 중 오류 발생: {str(e)}")
        raise
    finally:
        # 임시 파일 삭제
        os.unlink(temp_path)





def load_hwp(file_path, file_extension):
    """HWP/HWPX 문서 처리"""
    print(f"Loading {file_extension.upper()} file...")
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
