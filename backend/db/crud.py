from sqlalchemy.orm import Session
from . import models
from datetime import datetime
from sqlalchemy import select, func, delete, text

# 사용자 관련 CRUD
def create_user(db: Session, username: str, email: str, password_hash: str):
    db_user = models.User(username=username, email=email, password_hash=password_hash)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# 사용자의 id로 사용자 정보를 가져오는 함수
def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

# DB의 documents 테이블에 문서 정보 저장
def add_documents(db: Session, filename: str, s3_key: str, upload_time: datetime, user_id: int):
    db_document = models.Document(filename=filename, s3_key=s3_key, upload_time=upload_time, user_id=user_id)
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document



# 문서 청크를 저장하는 함수
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

# 문서의 id로 문서 청크를 가져오는 함수
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

# 디렉토리의 정보만 가져오는 함수
def get_only_directory(db: Session):
    stmt = select(models.Directory).where(models.Directory.is_directory == True)
    result = db.execute(stmt)
    directories = result.scalars().all()
    return [{"id": d.id, "name": d.name, "path": d.path, "parent_id": d.parent_id} for d in directories]

def get_parent_id_by_id(db: Session, item_id: str):
    """아이템의 id로 해당 아이템 레코드에서 parent_id 필드의 값을 가져온다."""
    stmt = select(models.Directory.parent_id).where(models.Directory.id == item_id)
    result = db.execute(stmt)
    return result.scalar()



def get_directory_id_by_path(db: Session, path: str):
    """아이템의 경로 값으로 해당 아이템의 id값을 가져온다."""
    stmt = select(models.Directory.id).where(models.Directory.path == path)
    result = db.execute(stmt)
    return result.scalar()

# 특정 파일의 경로에 존재하는 부모 디렉토리의 아이디를 가져오는 함수
def get_parent_id_by_path(db: Session, path: str):
    """아이템의 경로 값으로 해당 아이템의 parent_id필드의 값을 가져온다."""
    stmt = select(models.Directory.parent_id).where(models.Directory.path == path)
    result = db.execute(stmt)
    return result.scalar()

# s3_key로 파일 존재 여부 확인
def get_file_info_by_s3_key(db: Session, s3_key: str):
    return db.query(models.Document).filter(models.Document.s3_key == s3_key).first()

# 동일한 파일 이름이 존재하는 지 확인
def get_file_info_by_filename(db: Session, filename: str):
    """Documents 테이블에 동일한 이름의 파일이 있는지 확인한다."""
    return db.query(models.Document).filter(models.Document.filename == filename).first()

def delete_directory_by_id(db: Session, directory_id: str):
    db.execute(
        text("DELETE FROM directories WHERE id = :dir_id"),
        {"dir_id": directory_id}
    )
    db.commit()

def delete_document_by_id(db: Session, document_id: int):
    try:
        # 개별 DELETE 문을 실행
        db.execute(
            text("DELETE FROM document_chunks WHERE document_id = :doc_id"),
            {"doc_id": document_id}
        )
        
        db.execute(
            text("DELETE FROM documents WHERE id = :doc_id"),
            {"doc_id": document_id}
        )
        
        db.execute(
            text("DELETE FROM directories WHERE id = CAST(:doc_id AS TEXT)"),
            {"doc_id": document_id}
        )
        
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise e

def get_s3_key_by_id(db: Session, document_id: int):
    """Documents 테이블에서 해당 아이템의 id로 s3_key 필드의 값을 가져온다."""
    return db.query(models.Document).filter(models.Document.id == document_id).first().s3_key

def get_file_path_by_id(db: Session, item_id: str):
    """아이템의 id로 해당 아이템 레코드에서 path 필드의 값을 가져온다."""
    return db.query(models.Directory).filter(models.Directory.id == item_id).first().path

def get_file_name_by_id(db: Session, item_id: str):
    """아이템의 id로 해당 아이템 레코드에서 name 필드의 값을 가져온다."""
    return db.query(models.Directory).filter(models.Directory.id == item_id).first().name

def get_file_is_directory_by_id(db: Session, item_id: str):
    """아이템의 id로 해당 아이템 레코드에서 is_directory 필드의 값을 가져온다."""
    return db.query(models.Directory).filter(models.Directory.id == item_id).first().is_directory


def update_directory_path_and_parent(db: Session, item_id: str, target_new_path: str, target_new_parent_id: str):
    """아이템의 id로 해당 아이템의 경로와 부모 ID를 업데이트한다."""
    from sqlalchemy import update
    stmt = update(models.Directory).where(models.Directory.id == item_id).values(
        path=target_new_path,
        parent_id=target_new_parent_id
    )
    db.execute(stmt)
    db.commit()
    return db.query(models.Directory).filter(models.Directory.id == item_id).first()


# directories테이블에서 parent_id필드 값이 target의 id값인 레코드를 선택하여 가져온다.
def get_directory_by_parent_id(db: Session, item_id: str):
    """directories테이블의 parent_id필드 값 == item_id인 레코드를 선택하여 가져온다."""
    stmt = select(models.Directory).where(models.Directory.parent_id == item_id)
    result = db.execute(stmt)
    return result.scalars().all()


def update_directory_with_sql_file_safe(db: Session, item_id: str, target_item_path: str, target_new_path: str, target_new_parent_id: str):
    """SQL 스크립트를 개별 명령으로 분리하여 실행하여 디렉토리 정보를 업데이트한다."""
    from sqlalchemy import text
    
    # 트랜잭션 시작
    db.execute(text("BEGIN;"))
    
    # 1. 부모 ID 업데이트
    update_parent_sql = """
    UPDATE directories
    SET parent_id = :new_parent_id
    WHERE id = :tgt_id;
    """
    db.execute(
        text(update_parent_sql),
        {"tgt_id": item_id, "new_parent_id": target_new_parent_id}
    )
    
    # 2. 경로 업데이트를 위한 재귀 쿼리
    update_path_sql = """
    WITH RECURSIVE subtree AS (
        SELECT id, path
        FROM directories
        WHERE id = :tgt_id
        UNION ALL
        SELECT d.id, d.path
        FROM directories d
        JOIN subtree s ON d.parent_id = s.id
    )
    UPDATE directories AS d
    SET path = regexp_replace(d.path,
                             '^' || :old_prefix,
                             :new_prefix)
    FROM subtree
    WHERE d.id = subtree.id;
    """
    db.execute(
        text(update_path_sql),
        {"tgt_id": item_id, "old_prefix": target_item_path, "new_prefix": target_new_path}
    )
    
    # 트랜잭션 커밋
    db.commit()
    
    # # 선택적으로 확인용 SELECT 쿼리 실행
    # check_sql = """
    # SELECT id, path, parent_id
    # FROM directories
    # WHERE path LIKE :new_prefix || '%';
    # """
    # result = db.execute(
    #     text(check_sql),
    #     {"new_prefix": target_new_path}
    # )
    
    return db.query(models.Directory).filter(models.Directory.id == item_id).first()