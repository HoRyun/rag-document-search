from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import subprocess
import tempfile
from datetime import datetime
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA
import requests
import docx2txt

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 디렉토리 설정
DATA_DIR = "/data"
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Chroma 클라이언트 설정
CHROMA_HOST = os.getenv("CHROMA_HOST", "chroma")
CHROMA_PORT = os.getenv("CHROMA_PORT", "8000")

# Ollama 설정
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "localhost")
OLLAMA_PORT = os.getenv("OLLAMA_PORT", "11434")

# 임베딩 모델 설정
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# 벡터 스토어 설정
def get_vector_store():
    from chromadb.config import Settings
    
    persist_directory = os.path.join(DATA_DIR, "chroma_db")
    os.makedirs(persist_directory, exist_ok=True)
    
    client_settings = Settings(
        chroma_server_host=CHROMA_HOST,
        chroma_server_http_port=CHROMA_PORT
    )
    
    return Chroma(
        collection_name="documents",
        embedding_function=embeddings,
        persist_directory=persist_directory,
        client_settings=client_settings
    )

# LLM 설정
def get_llm():
    return Ollama(base_url=f"http://{OLLAMA_HOST}:{OLLAMA_PORT}", model="llama2")



@app.get("/")
def read_root():
    return {"message": "RAG API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_extension = file.filename.split('.')[-1].lower()
    supported_extensions = ['pdf', 'hwp', 'hwpx', 'docx']
    
    print(f"Processing file: {file.filename} with extension: {file_extension}")
    
    # 파일 확장자 확인
    if file_extension not in supported_extensions:
        raise HTTPException(status_code=400, detail=f"Only {', '.join(supported_extensions)} files are supported")
    
    # 파일 저장
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(UPLOAD_DIR, f"{timestamp}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    print(f"File saved to: {file_path}")
    
    try:
        # 문서 로드 및 텍스트 추출
        if file_extension == 'pdf':
            # PDF 처리
            print("Processing PDF file...")
            loader = PyPDFLoader(file_path)
            documents = loader.load()
            print(f"Extracted {len(documents)} pages from PDF")
            for i, doc in enumerate(documents[:1]):  # 첫 페이지만 출력
                print(f"Sample text from page {i+1} (first 200 chars): {doc.page_content[:200]}")
                
        elif file_extension == 'docx':
            # Word 문서 처리
            print("Processing DOCX file...")
            text = docx2txt.process(file_path)
            print(f"Extracted text from DOCX (first 200 chars): {text[:200]}")
            
            # TextLoader를 사용하기 위해 임시 텍스트 파일 생성
            with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp:
                temp.write(text)
                temp_path = temp.name
            
            loader = TextLoader(temp_path)
            documents = loader.load()
            print(f"Created {len(documents)} document(s) from DOCX")
            os.unlink(temp_path)  # 임시 파일 삭제
            
        elif file_extension in ['hwp', 'hwpx']:
            # HWP 문서 처리
            print(f"Processing {file_extension.upper()} file...")
            # hwp5txt 명령어 사용 (pyhwp 패키지 필요)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp:
                temp_path = temp.name
            
            try:
                print(f"Running hwp5txt on {file_path} with output to {temp_path}")
                subprocess.run(['hwp5txt', file_path, '--output', temp_path], check=True)
                
                # 추출된 텍스트 확인
                with open(temp_path, 'r', encoding='utf-8') as f:
                    extracted_text = f.read()
                print(f"Extracted text from {file_extension.upper()} (first 200 chars): {extracted_text[:200]}")
                
                loader = TextLoader(temp_path, encoding='utf-8')
                documents = loader.load()
                print(f"Created {len(documents)} document(s) from {file_extension.upper()}")
            except Exception as e:
                print(f"Error processing {file_extension.upper()} file: {str(e)}")
                import traceback
                print(traceback.format_exc())
                raise
            finally:
                os.unlink(temp_path)  # 임시 파일 삭제
        
        # 텍스트 분할
        print("Splitting text into chunks...")
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_documents(documents)
        print(f"Created {len(chunks)} chunks from document")
        
        # 메타데이터 추가
        for chunk in chunks:
            chunk.metadata["source"] = file.filename
            chunk.metadata["upload_time"] = timestamp
        
        # 벡터 스토어에 추가
        print("Adding chunks to vector store...")
        vector_store = get_vector_store()
        vector_store.add_documents(chunks)
        print("Successfully added to vector store")
        
        # 파일 업로드 및 처리가 완료되면 성공 메시지를 반환
        return {
            "message": f"Document {file.filename} uploaded and processed successfully",
            "chunks": len(chunks),
            "path": file_path
        }
    except Exception as e:
        import traceback
        print(f"Error processing document: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")
    
    
@app.post("/query")
async def query_documents(query: str = Form(...)):
    try:
        # 벡터 스토어 가져오기
        vector_store = get_vector_store()
        
        # LLM 가져오기
        llm = get_llm()
        
        # 검색 체인 생성
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=vector_store.as_retriever(search_kwargs={"k": 3})
        )
        
        # 질의 실행
        result = qa_chain({"query": query})
        
        return {"answer": result["result"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying documents: {str(e)}")

@app.get("/documents")
def list_documents():
    try:
        files = []
        for filename in os.listdir(UPLOAD_DIR):
            file_extension = filename.split('.')[-1].lower()
            if file_extension in ['pdf', 'hwp', 'hwpx', 'docx']:
                file_path = os.path.join(UPLOAD_DIR, filename)
                file_stat = os.stat(file_path)
                files.append({
                    "filename": filename,
                    "path": file_path,
                    "size": file_stat.st_size,
                    "uploaded_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                })
        return {"documents": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
