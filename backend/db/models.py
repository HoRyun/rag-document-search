from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from pgvector.sqlalchemy import Vector
from sqlalchemy.types import Boolean

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
    embedding = Column(Vector(1536))
    document = relationship("Document", back_populates="chunks") 

class Directory(Base):
    """디렉토리 모델"""
    __tablename__ = "directories"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    path = Column(String)
    is_directory = Column(Boolean)
    parent_id = Column(String)
    created_at = Column(DateTime, default=datetime.now)
