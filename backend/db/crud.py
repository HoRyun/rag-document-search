from sqlalchemy.orm import Session
from . import models

# 사용자 관련 CRUD
def create_user(db: Session, username: str, email: str, password_hash: str):
    db_user = models.User(username=username, email=email, password_hash=password_hash)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

# 문서 관련 CRUD
def create_document(db: Session, filename: str, s3_key: str, user_id: int):
    db_document = models.Document(filename=filename, s3_key=s3_key, user_id=user_id)
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

def add_document_chunk(db: Session, document_id: int, content: str, meta: dict, embedding=None):
    db_chunk = models.DocumentChunk(
        document_id=document_id,
        content=content,
        meta=meta,
        embedding=embedding
    )
    db.add(db_chunk)
    db.commit()
    db.refresh(db_chunk)
    return db_chunk

def get_document_chunks_by_document_id(db: Session, document_id: int):
    return db.query(models.DocumentChunk).filter(models.DocumentChunk.document_id == document_id).all()
