from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
from datetime import datetime
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA
import requests

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
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = os.getenv("CHROMA_PORT", "8000")

# Ollama 설정
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "localhost")
OLLAMA_PORT = os.getenv("OLLAMA_PORT", "11434")

# 임베딩 모델 설정
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# 벡터 스토어 설정
def get_vector_store():
    return Chroma(
        collection_name="documents",
        embedding_function=embeddings,
        client_settings={"chroma_server_host": CHROMA_HOST, "chroma_server_http_port": CHROMA_PORT}
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
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # 파일 저장
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(UPLOAD_DIR, f"{timestamp}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # PDF 로드
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        
        # 텍스트 분할
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_documents(documents)
        
        # 메타데이터 추가
        for chunk in chunks:
            chunk.metadata["source"] = file.filename
            chunk.metadata["upload_time"] = timestamp
        
        # 벡터 스토어에 추가
        vector_store = get_vector_store()
        vector_store.add_documents(chunks)
        
        return {
            "message": f"Document {file.filename} uploaded and processed successfully",
            "chunks": len(chunks),
            "path": file_path
        }
    except Exception as e:
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
            if filename.endswith('.pdf'):
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
