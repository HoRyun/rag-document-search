from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
import uuid
import json
import boto3

from db.database import get_db, engine
from db.models import User
from fast_api.security import get_current_user
from rag.document_service import get_all_documents, process_document, process_query
from rag.llm import get_llms_answer
from config.settings import AWS_SECRET_ACCESS_KEY,S3_BUCKET_NAME,AWS_ACCESS_KEY_ID,AWS_DEFAULT_REGION  # 설정 임포트
import os
import logging

from dotenv import load_dotenv
load_dotenv()


# 로거 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
logger.addHandler(handler)

# S3 클라이언트 초기화 (설정 사용)
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_DEFAULT_REGION
)
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
if not S3_BUCKET_NAME:
    raise ValueError("S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.")

router = APIRouter()


@router.get("/")
def list_items(
    path: str = Query("/", description="현재 경로"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    """지정된 경로의 파일 및 폴더 목록을 반환"""

    from db import crud
    from sqlalchemy import text
    try:
        
        filtered_items = []
        
        # 프론트 엔드에서 선택한 경로
        selected_path = path
        # <db에서 디렉토리 정보와 파일 정보 가져오기>

        # 커넥션 풀에서 직접 연결 가져오기
        with db.connection() as connection:
            # 파일 목록 쿼리
            file_query = text("""
                SELECT id, name, 'file' as type, path 
                FROM directories 
                WHERE path LIKE :selected_path || '/%' 
                AND path NOT LIKE :selected_path || '/%/%' 
                AND is_directory = FALSE
            """)
            file_result = connection.execute(file_query, {"selected_path": selected_path}).mappings().fetchall()
            
            # 디렉토리 목록 쿼리
            dir_query = text("""
                SELECT id, name, 'folder' as type, path 
                FROM directories 
                WHERE path LIKE :selected_path || '/%' 
                AND path NOT LIKE :selected_path || '/%/%' 
                AND is_directory = TRUE
            """)
            dir_result = connection.execute(dir_query, {"selected_path": selected_path}).mappings().fetchall()
        # </db에서 디렉토리 정보와 파일 정보 가져오기>

        # <가져온 정보를 filtered_items에 추가>
        filtered_items.extend([dict(item) for item in file_result])
        filtered_items.extend([dict(item) for item in dir_result])
        # </가져온 정보를 filtered_items에 추가>

        
        return {"items": filtered_items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing items: {str(e)}")

@router.post("/manage")
async def upload_document(
    files: List[UploadFile] = File(None), # None을 ... 으로 변경
    path: str = Form("/"),
    directory_structure: str = Form(None),
    operations: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """통합 문서 / 디렉토리 관리"""
    from typing import Dict, Any
    try:
        results = {
            "success": True,
            "message": "작업이 완료되었습니다.",
            "items": []
        }

        # 1 & 2. 파일 업로드 처리 (디렉토리 구조 포함 또는 단일 파일)
        if files:
            file_results = await process_file_uploads(files, path, directory_structure, current_user, db)
            results["items"].extend(file_results)

        
        # 3 & 4. 디렉토리 작업 처리 (생성, 이동, 삭제 등)
        if operations:
            try:
                ops_data: Dict[str, Any] = json.loads(operations)
                op_results = process_directory_operations(ops_data, current_user.id, db)
                results["items"].extend(op_results)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid operations format")
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error managing documents: {str(e)}")

@router.get("/structure")
async def get_filesystem_structure(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    전체 파일 시스템 구조 반환
    """
    from db import crud
    try:
        # 디렉토리만 필터링. 디렉토리 구조만 보내면 됨.
        directories = crud.get_only_directory(db)

        # <로직>
        # 1) 최상위 디렉토리 이름(root) 찾기
        root = next((d['name'] for d in directories if d['id'] == 'home'), None)
        if root is None:
            raise ValueError("최상위 디렉토리(id='home')를 찾을 수 없습니다.")

        # 2) 새 리스트에 수정된 객체 생성
        your_result = []
        for d in directories:
            # 앞뒤 슬래시 제거 후 분할
            parts = d['path'].strip('/').split('/')
            # 최상위 디렉토리 이름이 맨 앞에 있으면 제거
            if parts and parts[0] == root:
                parts = parts[1:]
            # 남은 부분으로 새 경로 구성 (없으면 루트 '/')
            new_path = '/' + '/'.join(parts) if parts else '/'
            your_result.append({
                'id':   d['id'],
                'name': d['name'],
                'path': new_path
            })
        # </로직>
        directories = your_result

        return {
            "directories": directories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching filesystem structure: {str(e)}")

@router.post("/query")
async def query_document(query: str = Form(...)):
    """문서 질의응답 엔드포인트"""
    from db.database import engine  # 기존 엔진을 임포트

    docs = process_query(query,engine)

    answer = get_llms_answer(docs, query)

    return {"answer": answer} 


# 유틸 함수

async def process_file_uploads(files, path, directory_structure, current_user, db):
    """파일 업로드 처리 (디렉토리 구조 포함/미포함)"""
    import json
    from typing import Dict, Any
    from db import crud
    # 결과
    results = []

    # 단일 파일 거르기
    if len(files) == 1:
        document_id = None
        try:
            # <if len(files) == 1: 의 예외 처리 구역>
            # <s3업로드, 파일 처리 및 return 예외 처리>
            try:
                # 파일 이름과 파일 경로를 미리 준비해서 전달하기.
                file_name = files[0].filename
                file_path = path+file_name


                # <파일의 내용을 여러 번 재사용하기 위해 메모리에 로드.>
                file_content = await files[0].read()
                # </파일의 내용을 여러 번 재사용하기 위해 메모리에 로드.>




                # S3 업로드.
                # 이 부분에서 파일은 한 번 읽힘.
                s3_key = f"uploads/{current_user.username}/{file_name}"
                s3_client.upload_fileobj(
                    Fileobj=files[0].file,
                    Bucket=S3_BUCKET_NAME,
                    Key=s3_key,
                    ExtraArgs={'ContentType': files[0].content_type}
                )




                # 3. DB에 파일 정보 저장 및 문서 처리
                document_id = await process_document(
                    file_name=file_name,# 파일의 정보를 사용하기 위해 그대로 전달. 파일의 정보 중에서 파일 이름만 필요하므로 미리 파일 이름을 뽑아서 전달하기.
                    file_path=file_path,
                    file_content=file_content, # 메모리에 읽은 파일의 실제 데이터를 전달.
                    user_id=current_user.id,
                    db=db,
                    s3_key=s3_key
                )

                # </s3업로드, 파일 처리 및 return 예외 처리>
            except Exception as e:
                print(f"s3 업로드 중 오류 발생: {str(e)}")
                results.append({
                    "type": "file",
                    "id": document_id,
                    "name": files[0].filename,
                    "path": path,
                    "status": "error",
                    "error": str(e)
                }) 
            # <디렉토리 정보 처리>
            #이 파일의 parent_id 얻어오는 쿼리문. # 이 코드에는 문제가 있다. 문서 id는 문서 자체의 id이다. 해당
            parent_id = crud.get_parent_id_by_id(db, str(document_id))

            # 단일 파일 업로드 시에는 고유한 아이디 값으로 저장함.
            id = str(uuid.uuid4())

            crud.create_directory(
                db=db,
                id=id,
                name=files[0].filename,
                path=path,
                is_directory=False,
                parent_id=parent_id,
                created_at=datetime.now().isoformat()
            )
            # </디렉토리 정보 처리>            
            # </if len(files) == 1: 의 예외 처리 구역>
        except Exception as e:
            results.append({
                "type": "file",
                "id": id,
                "name": files[0].filename,
                "path": path,
                "status": "error",
                "error": str(e)
            })
             
    else: # 아니면 디렉토리 구조 포함된 데이터.
        # 1. 문자열로 받은 디렉토리 구조를 파이썬 dict로 변환
        tree: Dict[str, Any] = json.loads(directory_structure)

        # 2. 최상위 디렉토리 처리
        root_name, root_children = next(iter(tree.items()))
        root_id = "home"
        # root_path에 root_name 포함 
        root_path = "/"  
        # DB 저장: 최상위 디렉토리
        # <예외 처리 구역>
        try:
            # db_save
            # 디렉토리 정보 저장 <- 실제로는 db 테이블에 저장됨.
            crud.create_directory(
                db=db,
                id=root_id,
                name=root_name,
                path=root_path,
                is_directory=True,
                parent_id=None,
                created_at=datetime.now().isoformat()
            )
            results.append({
                "type": "directory",
                "id": root_id,
                "name": root_name,
                "path": root_path,
                "status": "success"
            })
        except Exception as e:
            results.append({
                "type": "directory",
                "id": root_id,
                "name": root_name,
                "path": root_path,
                "status": "error",
                "error": str(e)
            })
        # </예외 처리 구역>

        # 3. 재귀로 하위 디렉토리 및 파일 처리
        async def traverse(name: str, subtree: Dict[str, Any], parent_id: str, parent_path: str):
            # 디렉토리 생성
            current_id = str(uuid.uuid4())
            current_name = name
            #* 변경: OS 종속적 os.path.join 대신 '/' 문자열 조합 사용
            current_path = f"{parent_path.rstrip('/')}/{name}" 
            
            # DB 저장: 디렉토리
            # <예외 처리 구역>
            try:
                # db_save(id=current_id, name=current_name, path=current_path, is_directory=True, parent_id=parent_id)
                crud.create_directory(
                    db=db,
                    id=current_id,
                    name=current_name,
                    path=current_path,
                    is_directory=True,
                    parent_id=parent_id,
                    created_at=datetime.now().isoformat()
                )            
                results.append({
                    "type": "directory",
                    "id": current_id,
                    "name": current_name,
                    "path": current_path,
                    "status": "success"
                })
            except Exception as e:
                results.append({
                    "type": "directory",
                    "id": current_id,
                    "name": current_name,
                    "path": current_path,
                    "status": "error",
                    "error": str(e)
                })
            # </예외 처리 구역>

            # 3-1. 하위 디렉토리 탐색
            for child_name, child_tree in subtree.items():
                await traverse(child_name, child_tree, current_id, current_path)

            # 3-2. 해당 디렉토리에 포함된 파일 처리
            prefix = "/"
            for upload_file in files:
                # 파일 객체는 upload_file에 저장됨.

                _, _, result = upload_file.filename.partition('/')
                full_path = result = '/'+ result
                if not full_path.startswith(prefix):
                    continue
                rel_path = full_path[len(prefix):]
                dir_part, file_name = os.path.split(rel_path)
                current_rel = current_path[len(root_path):].strip("/")  #*
                if dir_part == current_rel:
                    # file_id = str(uuid.uuid4())
                    file_path= result # f"{current_path.rstrip('/')}/{file_name}" <- result로 대체.
                    # file_path = os.path.join(current_path, file_name)  #* 변경된 부분
                    # DB 저장: 파일
                    
                    document_id = None
                    # <복붙>
                    try:
                        # <s3업로드 예외 처리 try except>
                        try:
                            # <파일의 내용을 여러 번 재사용하기 위해 메모리에 로드.>
                            file_content = await upload_file.read()
                            # </파일의 내용을 여러 번 재사용하기 위해 메모리에 로드.>

                            # S3 업로드 (BytesIO 없이 UploadFile.file 직접 사용)
                            s3_key = f"uploads/{current_user.username}/{file_name}"
                            s3_client.upload_fileobj(
                                Fileobj=upload_file.file,
                                Bucket=S3_BUCKET_NAME,
                                Key=s3_key,
                                ExtraArgs={'ContentType': upload_file.content_type}
                            )                                
                        except Exception as e:
                            print(f"s3 업로드 중 오류 발생: {str(e)}")
                            results.append({
                                "type": "file",
                                "id": document_id,
                                "name": file_name,
                                "path": file_path,
                                "status": "error",
                                "error": str(e)
                            })
                        # </<s3업로드 예외 처리 try except>>

                        # 3. DB 저장 및 문서 처리
                        document_id = await process_document(
                            file_name=file_name,
                            file_path=file_path,
                            file_content=file_content,
                            user_id=current_user.id,
                            db=db,
                            s3_key=s3_key
                        )
                        # </s3업로드, 파일 처리 및 return 예외 처리>
                    
                        # <디렉토리 정보 처리>
                        #이 파일의 parent_id 얻어오는 쿼리문.
                        parent_id = crud.get_parent_id_by_id(db, str(document_id))

                        # 디렉토리 업로드 시에는 해당 문서의 id를 사용.
                        id = document_id

                        crud.create_directory(
                            db=db,
                            id=id,
                            name=file_name,
                            path=file_path,
                            is_directory=False,
                            parent_id=parent_id,
                            created_at=datetime.now().isoformat()
                        )
                        # </디렉토리 정보 처리> 

                        # result에 결과 추가
                        results.append({
                            "type": "file",
                            "id": document_id,
                            "name": file_name,
                            "path": file_path,
                            "status": "success"
                        })
                    except Exception as e:
                        results.append({
                            "type": "file",
                            "id": document_id,
                            "name": upload_file.filename,
                            "path": path,
                            "status": "error",
                            "error": str(e)
                        })                    
                    # </복붙>
                    

        # 4. 실제 트리 순회 시작
        # root 자체가 아닌, 루트의 자식들부터 순회하도록 변경  #* 변경된 부분
        for child_name, child_tree in root_children.items():
            await traverse(child_name, child_tree, root_id, root_path)

    return results


def process_directory_operations(operations, user_id, db):
    """디렉토리 작업 처리 (생성, 이동, 삭제 등)"""
    from db import crud
    results = []
    
    for op in operations:
        op_type = op.get("operation_type")
        
        reserved_path = op.get("path", "/")

        try:
            # 새 폴더 생성
            if op_type == "create":
                dir_id = str(uuid.uuid4())
                path = op.get("path", "/")
                name = op.get("name")
                
                # 경로 정규화
                if not path.endswith("/"):
                    path += "/"
                    
                new_path = path + name
                
                # 부모 디렉토리 id 가져오는 코드.
                parent_id = crud.get_parent_id_by_path(db,reserved_path)
                
                # 디렉토리 정보 저장
                crud.create_directory(
                    db=db,
                    id=dir_id,
                    name=name,
                    path=new_path,
                    is_directory=True,
                    parent_id=parent_id,
                    created_at=datetime.now().isoformat()
                )
                
                results.append({
                    "operation": "create",
                    "type": "directory",
                    "id": dir_id,
                    "name": name,
                    "path": new_path,
                    "status": "success"
                })
            
            # 항목 이동
            # elif op_type == "move":
            #     item_id = op.get("item_id")
            #     new_path = op.get("new_path")
                
            #     if item_id in filesystem:
            #         # 디렉토리인 경우
            #         item = filesystem[item_id]
            #         old_path = item["path"]
                    
            #         # 경로 업데이트
            #         item["path"] = new_path
            #         filesystem[item_id] = item
                    
            #         # TODO: 실제 구현에서는 DB에서 경로 업데이트
                    
            #         results.append({
            #             "operation": "move",
            #             "type": "directory" if item["is_directory"] else "file",
            #             "id": item_id,
            #             "name": item["name"],
            #             "old_path": old_path,
            #             "new_path": new_path,
            #             "status": "success"
            #         })
            #     else:
            #         # TODO: 파일인 경우 DB에서 경로 업데이트
                    
            #         results.append({
            #             "operation": "move",
            #             "id": item_id,
            #             "new_path": new_path,
            #             "status": "not_found",
            #             "error": "Item not found"
            #         })
            
            # 항목 삭제
            # elif op_type == "delete":
            #     item_id = op.get("item_id")
                
            #     if item_id in filesystem:
            #         # 디렉토리인 경우
            #         item = filesystem[item_id]
            #         del filesystem[item_id]
                    
            #         # TODO: 실제 구현에서는 DB에서 항목 삭제
                    
            #         results.append({
            #             "operation": "delete",
            #             "type": "directory" if item["is_directory"] else "file",
            #             "id": item_id,
            #             "name": item["name"],
            #             "path": item["path"],
            #             "status": "success"
            #         })
            #     else:
            #         # TODO: 파일인 경우 DB에서 삭제
                    
            #         results.append({
            #             "operation": "delete",
            #             "id": item_id,
            #             "status": "not_found",
            #             "error": "Item not found"
            #         })
            
            # 항목 이름 변경
            # elif op_type == "rename":
            #     item_id = op.get("item_id")
            #     new_name = op.get("name")
                
            #     if item_id in filesystem:
            #         # 디렉토리인 경우
            #         item = filesystem[item_id]
            #         old_name = item["name"]
                    
            #         # 이름 업데이트
            #         item["name"] = new_name
                    
            #         # 경로도 업데이트
            #         path_parts = item["path"].rsplit("/", 1)
            #         if len(path_parts) > 1:
            #             item["path"] = path_parts[0] + "/" + new_name
            #         else:
            #             item["path"] = "/" + new_name
                    
            #         # filesystem[item_id] = item
                    
            #         # TODO: 실제 구현에서는 DB에서 이름 업데이트
                    
            #         results.append({
            #             "operation": "rename",
            #             "type": "directory" if item["is_directory"] else "file",
            #             "id": item_id,
            #             "old_name": old_name,
            #             "new_name": new_name,
            #             "path": item["path"],
            #             "status": "success"
            #         })
            #     else:
            #         # TODO: 파일인 경우 DB에서 이름 업데이트
                    
            #         results.append({
            #             "operation": "rename",
            #             "id": item_id,
            #             "new_name": new_name,
            #             "status": "not_found",
            #             "error": "Item not found"
            #         })
            
            else:
                results.append({
                    "operation": op_type,
                    "status": "error",
                    "error": f"Unknown operation type: {op_type}"
                })
        
        except Exception as e:
            results.append({
                "operation": op_type,
                "status": "error",
                "error": str(e)
            })
    
    return results


def get_file_type(filename):
    """파일 타입 유추"""
    if not filename:
        return "blank"
    
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext in ["pdf"]:
        return "document"
    elif ext in ["docx", "doc", "hwp", "hwpx"]:
        return "document"
    elif ext in ["xlsx", "xls", "csv"]:
        return "spreadsheet"
    elif ext in ["jpg", "jpeg", "png", "gif"]:
        return "image"
    elif ext in ["txt"]:
        return "blank"
    elif not ext:
        return "folder"
    
    return "blank"
