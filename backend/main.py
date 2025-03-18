from fastapi import FastAPI, Depends, File, UploadFile, Form, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import tempfile
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import List


from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA
import docx2txt
import subprocess


from db.database import engine, get_db
from db.models import Base, User, Document, DocumentChunk
from langchain_postgres import PGVector


import schemas
from auth import authenticate_user, create_access_token, get_password_hash, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES

# 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 환경 변수 설정
DATA_DIR = "/data"
TEST_MODE = os.environ.get('TEST_MODE', 'False').lower() == 'true'
OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'localhost')
OLLAMA_PORT = os.environ.get('OLLAMA_PORT', '11434')

# 업로드 디렉토리 설정
if TEST_MODE:
    UPLOAD_DIR = tempfile.mkdtemp()
    print(f"Using temporary directory for uploads: {UPLOAD_DIR}")
else:
    UPLOAD_DIR = os.environ.get('UPLOAD_DIR', '/data/uploads')

os.makedirs(UPLOAD_DIR, exist_ok=True)


# 임베딩 모델 함수
def get_embeddings():
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


# LLM 모델 함수
def get_llm():
    return Ollama(base_url=f"http://{OLLAMA_HOST}:{OLLAMA_PORT}", model="llama2")


# 벡터 스토어 함수 (PostgreSQL 사용)
def get_vector_store():
    
    embeddings = get_embeddings()
    
    vector_store = PGVector(
        collection_name="document_chunks",
        connection="postgresql://postgres:postgres@db:5432/ragdb",
        embeddings=embeddings,
        use_jsonb=True,
    )
    
    return vector_store


def process_pdf(file_path):
    """PDF 파일 처리"""
    print("Processing PDF file...")
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    print(f"Extracted {len(documents)} pages from PDF")
    return documents


def process_docx(file_path):
    """Word 문서 처리"""
    print("Processing DOCX file...")
    text = docx2txt.process(file_path)
    
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
    
    # 메타데이터 추가
    for chunk in chunks:
        chunk.metadata["source"] = file_name
        chunk.metadata["upload_time"] = timestamp
    
    return chunks

@app.get("/")
def read_root():
    return {"message": "RAG Document Search API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# 회원가입 엔드포인트
@app.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 사용자 이름 중복 확인
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # 이메일 중복 확인
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 비밀번호 해싱 및 사용자 생성
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, email=user.email, password_hash=hashed_password)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


# 로그인 엔드포인트
@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


# 현재 사용자 정보 조회
@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/documents")
def list_documents(db: Session = Depends(get_db)):
    try:
        documents = db.query(Document).all()
        return {"documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "uploaded_at": doc.upload_time.isoformat()
            } for doc in documents
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_extension = file.filename.split('.')[-1].lower()
    supported_extensions = ['pdf', 'hwp', 'hwpx', 'docx']
    
    print(f"Processing file: {file.filename} with extension: {file_extension}")
    
    if file_extension not in supported_extensions:
        raise HTTPException(status_code=400, detail=f"Only {', '.join(supported_extensions)} files are supported")
    
    # 파일 저장
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(UPLOAD_DIR, f"{timestamp}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    print(f"File saved to: {file_path}")
    
    try:
        # 문서 DB에 저장 (임시로 user_id=1 사용)
        db_document = Document(
        filename=file.filename, 
        upload_time=datetime.now(), 
        user_id=current_user.id  # 하드코딩된 user_id=1 대신 현재 사용자 ID 사용
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        # 파일 형식에 따른 처리
        if file_extension == 'pdf':
            documents = process_pdf(file_path)
        elif file_extension == 'docx':
            documents = process_docx(file_path)
        elif file_extension in ['hwp', 'hwpx']:
            documents = process_hwp(file_path, file_extension)
        
        # 청크 준비
        chunks = prepare_chunks(documents, file.filename, timestamp)
        
        # 임베딩 생성 및 DB에 저장
        embeddings = get_embeddings()
        vector_store = get_vector_store()
        
        # 벡터 스토어에 문서 추가
        vector_store.add_documents(chunks)
        
        # DB에 청크 정보 저장
        for chunk in chunks:
            db_chunk = DocumentChunk(
                document_id=db_document.id,
                content=chunk.page_content,
                metadata=chunk.metadata
            )
            db.add(db_chunk)
        
        db.commit()
        
        return {
            "message": f"Document {file.filename} uploaded and processed successfully",
            "chunks": len(chunks),
            "path": file_path,
            "document_id": db_document.id
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
        import traceback
        print(f"Error querying documents: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error querying documents: {str(e)}")
