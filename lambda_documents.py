import json
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy.orm import Session
import sys
import os

# Lambda 환경에서 모듈 경로 설정
if os.environ.get('AWS_EXECUTION_ENV') is not None:
    sys.path.append('/opt/python')

from db.database import get_db
from db.models import User, Document
from db.schemas import DocumentStructureResponse
from fast_api.security import get_current_user

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/fast_api/documents/structure", response_model=DocumentStructureResponse)
async def documents_structure(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """문서 구조 조회 엔드포인트"""
    documents = db.query(Document).filter(Document.user_id == current_user.id).all()
    
    structure = {
        "documents": [
            {
                "id": doc.id,
                "name": doc.name,
                "path": doc.path,
                "created_at": doc.created_at,
                "updated_at": doc.updated_at
            } for doc in documents
        ]
    }
    
    return DocumentStructureResponse(**structure)

# Lambda 핸들러
handler = Mangum(app)