from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy.dialects.postgresql import ARRAY
import sqlalchemy as sa
from sqlmodel import Field
from pgvector.sqlalchemy import Vector

from db.database import Base

class User(Base):
    """사용자 모델"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    
    documents = relationship("Document", back_populates="owner")

class Document(Base):
    """문서 모델"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    upload_time = Column(DateTime, default=datetime.now)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document")

class DocumentChunk(Base):
    """문서 청크 모델"""
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    content = Column(String)
    meta = Column(JSON)
    # SQLAlchemy로 저장할 때 사용하는 임베딩 필드 (ARRAY 타입)
    embedding = Field(default=None, sa_column=Column(Vector(1536)))
    # schema.sql에서 추가되는 pgvector 전용 필드 (vector 타입)
    # 이 필드는 SQLAlchemy ORM에서는 접근하지 않음
    # embedding_vector = Column(sa.dialects.postgresql.ARRAY(sa.Float), nullable=True)
    
    document = relationship("Document", back_populates="chunks") 