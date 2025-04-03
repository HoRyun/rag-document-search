from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from db.models import User
from fast_api.security import get_current_user
from rag.document_service import get_all_documents, process_document, query_documents

router = APIRouter()

@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    """문서 목록 조회 엔드포인트"""
    try:
        documents = get_all_documents(db)
        return {"documents": [
            {
                "id": doc.id,
                "filename": doc.filename,
                "uploaded_at": doc.upload_time.isoformat()
            } for doc in documents
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """문서 업로드 엔드포인트"""
    # 성공시 code=200, 실패시 code=500
    code = process_document(file, current_user.id, db)
    
    # 파일 업로드 및 처리가 완료되면 성공 메시지를 반환
    return {
        "message": f"Document {file.filename} uploaded and processed successfully",
        "code": code
    }

@router.post("/query")
async def query_document(query: str = Form(...)):
    """문서 질의응답 엔드포인트"""
    answer = query_documents(query)
    return {"answer": answer} 