from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime

# 사용자 스키마
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

# 토큰 스키마
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# 문서 스키마
class DocumentBase(BaseModel):
    filename: str

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: int
    upload_time: datetime
    
    model_config = ConfigDict(from_attributes=True)

# 문서 청크 스키마
class DocumentChunkBase(BaseModel):
    content: str
    meta: Dict[str, Any]

class DocumentChunkCreate(DocumentChunkBase):
    document_id: int

class DocumentChunkResponse(DocumentChunkBase):
    id: int
    document_id: int
    
    model_config = ConfigDict(from_attributes=True)

# 검색 쿼리 스키마
class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    answer: str 