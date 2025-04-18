from sqlalchemy.orm import Session
from . import models
from datetime import datetime
from sqlalchemy import select, func

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
def create_document(db: Session, filename: str, user_id: int):
    db_document = models.Document(filename=filename, user_id=user_id)
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

# 디렉토리 관련 CRUD
def create_directory(db: Session, id: str, name: str, path: str, is_directory: bool, parent_id: str, created_at: datetime):
    db_directory = models.Directory(
        id=id, 
        name=name, 
        path=path, 
        is_directory=is_directory, 
        parent_id=parent_id,
        created_at=created_at
    )
    db.add(db_directory)
    db.commit()
    db.refresh(db_directory)
    return db_directory

# 정상 작동하는 함수
def get_only_directory(db: Session):
    stmt = select(models.Directory).where(models.Directory.is_directory == True)
    result = db.execute(stmt)
    directories = result.scalars().all()
    return [{"id": d.id, "name": d.name, "path": d.path} for d in directories]

# 정상 작동하는 함수
def get_parent_id(db: Session, document_id: str):
    stmt = select(models.Directory.parent_id).where(models.Directory.id == document_id)
    result = db.execute(stmt)
    return result.scalar()

# 비정상.일단 주석처리. - 이 함수는 documents/ 엔드포인트와 관련있음. 메인 화면의 요소를 업데이트 하는 코드
# def get_specific_directory(db: Session, path: str, is_directory: bool):
#     #현재 검색이 디렉토리 구조 가져오기 일 경우
#     if is_directory:
#         # 쿼리: directories 테이블의 name속성의 값 앞에 '/'문자열을 붙인 값을 A라고 할 때, (path변수+A의 값) == (path 속성의 값) 을 만족하는 레코드의 모든 속성을 가져오기
#         stmt = select(models.Directory).where(models.Directory.path == func.concat(path, '/', models.Directory.name))
#         result = db.execute(stmt)
#         directories = result.scalars().all()
#         return [{"id": d.id, "name": d.name, "path": d.path, "type":"directory"} for d in directories]
#     #현재 검색이 파일 구조 가져오기 일 경우
#     else:
#         # 쿼리: directories 테이블의 name속성의 값 앞에 '/'문자열을 붙인 값을 A라고 할 때, (path변수+A의 값) == (path 속성의 값) 을 만족하는 레코드의 모든 속성을 가져오기
#         stmt = select(models.Directory).where(models.Directory.path == func.concat(path, '/', models.Directory.name))
#         result = db.execute(stmt)   
#         files = result.scalars().all()
#         return [{"id": f.id, "name": f.name, "path": f.path, "size": f.size, "type":"file"} for f in files]


# 이것도 비정상이므로 주석 처리 하기.
# def add_directory_size(db: Session, document_id: int, size: int):
    
#     # documents 테이블에서 문서 정보 가져오기
#     stmt = select(models.Document).where(models.Document.id == document_id)
#     result = db.execute(stmt)
#     document = result.scalars().first()
    
#     if not document:
#         return None
        
#     # directories 테이블에서 디렉토리 정보 가져오기 - 여기서 directory_id를 문자열로 사용
#     stmt = select(models.Directory).where(models.Directory.id == str(document_id))
#     result = db.execute(stmt)
#     directory = result.scalars().first()
    
#     if not directory:
#         return None
        
#     directory.size = document.document_size
#     db.commit()
#     db.refresh(directory)
#     return directory
