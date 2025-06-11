from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# 사용자 스키마
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    username: str
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# 토큰 스키마
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# 문서 스키마
class DocumentBase(BaseModel):
    filename: str
    s3_key: str

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: int
    upload_time: datetime
    
    class Config:
        from_attributes = True

# 문서 청크 스키마
class DocumentChunkBase(BaseModel):
    content: str
    meta: dict

class DocumentChunkCreate(DocumentChunkBase):
    document_id: int

class DocumentChunkResponse(DocumentChunkBase):
    id: int
    document_id: int
    
    class Config:
        from_attributes = True

# 검색 쿼리 스키마
class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    answer: str 

# 디렉토리 스키마
class DirectoryBase(BaseModel):
    id: str
    name: str
    path: str
    is_directory: bool

# class ChatLog(BaseModel):
#     id: int
#     content: str
#     sender: str
#     owner_id: int
