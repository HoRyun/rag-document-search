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

''' 함수 인덱스


get("/")
list_items

post("/manage")
upload_document

get("/structure")
get_filesystem_structure

post("/query")
query_document

디렉토리 업로드 처리
process_directory_uploads

파일 업로드 처리
process_file_uploads

디렉토리 작업 처리(생성, 이동, 삭제 등)
process_directory_operations

파일 타입 유추
get_file_type

고유 파일명 생성
generate_unique_filename

최상위 디렉토리 처리
process_top_directory

디렉토리 테이블에 디렉토리 정보를 저장
store_directory_table

파일 이름 추출
set_filename

파일 경로 설정
set_file_path

s3 업로드
upload_file_to_s3

'''


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
                AND id <> 'root'
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
    path: str = Form('/'),
    directory_structure: str = Form(None),
    operations: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """통합 문서 / 디렉토리 관리"""
    from typing import Dict, Any

    # API 테스트 용 코드.
    # if current_upload_path == '':
    #     current_upload_path = None
    # if operations == '':
    #     operations = None
    
    # path는 사용자가 유저 인터페이스 창에서 선택한 경로이다.
    current_upload_path = path

    try:
        results = {
            "success": True,
            "message": "작업이 완료되었습니다.",
            "items": []
        }

        # 1 & 2. 파일 업로드 처리 (디렉토리 구조 포함 또는 단일 파일)
        # 파일이 존재하는 경우에 아래 코드 실행. (operations작업과 구분.)
        if files:
            # 단일 파일인 경우
            if os.path.dirname(files[0].filename) == "":
                # 파일 업로드 처리
                file_results = await process_file_uploads(files, current_upload_path, current_user, db)
                results["items"].extend(file_results)
            else:
                # 디렉토리 업로드인 경우
                # 디렉토리 업로드 처리
                directory_results = await process_directory_uploads(current_upload_path, directory_structure, db)
                results["items"].extend(directory_results)

                # 파일 업로드 처리
                file_results = await process_file_uploads(files, current_upload_path, current_user, db)
                results["items"].extend(file_results)
        
        # 3 & 4. 디렉토리 작업 처리 (생성, 이동, 삭제 등)
        if operations:
            try:
                # 
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
    # get_filesystem_structure 엔드포인트와 "/"엔드포인트가 프론트엔드 입장에서 어떤 차이를 가지는지 알아보기.
    from db import crud
    try:
        # 디렉토리만 필터링. 디렉토리 구조만 보내면 됨.
        directories = crud.get_only_directory(db)

        # <로직>
        # 1) 최상위 디렉토리 이름(root) 찾기
        root = next((d['name'] for d in directories if d['parent_id'] == "root"), None)
        if not root:
            raise ValueError("최상위 디렉토리(parent_id='root')를 찾을 수 없습니다.")

        # 2) 새 리스트에 수정된 객체 생성
        your_result = []
        for d in directories:
            # 루트 디렉토리는 제외.( 루트 디렉토리는 프론트엔드에서 처리해준다.)
            # db입장에서 필요한 데이터이지만 프론트 엔드로 해당 정보를 보낼 시 이미 프론트엔드에서 처리하기 때문에 충돌이 발생하여 버그가 발생함.
            if d['id'] == "root":
                continue
            your_result.append({
                'id':   d['id'],
                'name': d['name'],
                'path': d['path']
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
async def process_directory_uploads(current_upload_path, directory_structure, db):
    """디렉토리 업로드 처리"""
    # 라이브러리 임포트
    import json
    from typing import Dict, Any
    from db import crud

    # 결과가 저장될 리스트를 미리 선언
    results = []

    # 1. 문자열로 받은 디렉토리 구조를 파이썬 dict로 변환
    tree: Dict[str, Any] = json.loads(directory_structure)

    # 2. 최상위 디렉토리 처리
        # 최상위 디렉토리를 처리하는 함수 선언
    top_dir_results, top_dir_children = process_top_directory(tree, current_upload_path, db)
 
    # Store DB : directories 테이블에 저장
    results.append(store_directory_table(db, top_dir_results))

    # 3. 재귀로 하위 디렉토리 및 파일 처리
    async def traverse(name: str, subtree: Dict[str, Any], parent_id: str, parent_path: str):
        # 디렉토리 생성
        child_dir_id = str(uuid.uuid4())
        child_dir_name = name
        #* 변경: OS 종속적 os.path.join 대신 '/' 문자열 조합 사용
        child_dir_path = f"{parent_path.rstrip('/')}/{name}"

        # 디렉토리 테이블에 저장할 딕셔너리 생성
        child_dir_value_dict = {
            "id": child_dir_id,
            "name": child_dir_name,
            "path": child_dir_path,
            "is_directory": True,
            "parent_id": parent_id,
            "created_at": datetime.now().isoformat()
        }
        
        # Store DB : directories 테이블에 저장
        results.append(store_directory_table(db, child_dir_value_dict))
        

        # 3-1. 하위 디렉토리 탐색
        for child_name, child_tree in subtree.items():
            await traverse(child_name, child_tree, child_dir_id, child_dir_path)


    # 4. 실제 트리 순회 시작
    # root 자체가 아닌, 루트의 자식들부터 순회하도록 변경  #* 변경된 부분
    for child_name, child_tree in top_dir_children.items():
        await traverse(child_name, child_tree, top_dir_results["id"], top_dir_results["path"])

    return results


async def process_file_uploads(files, current_upload_path, current_user, db):
    """파일 업로드 처리"""
    from db import crud
    # 결과가 저장될 리스트를 미리 선언
    results = []

    # 3-2. 해당 디렉토리에 포함된 파일 처리
    for upload_file in files:
        
        # 파일 이름을 추출.
        file_name = set_filename(upload_file, db)

        # s3 key 생성
        s3_key = f"uploads/{current_user.username}/{file_name}"

        # 파일 경로 설정
        file_path, file_path_dir = set_file_path(file_name, upload_file, current_upload_path)

        # file_path_dir가 db-> directories 테이블에 존재하면 그 레코드에서 id값을 가져온다.
        parent_id = crud.get_directory_id_by_path(db, file_path_dir)

        # 파일 업로드 처리 시작
        # <파일의 내용을 여러 번 재사용하기 위해 메모리에 로드.>
        file_content = await upload_file.read()

        # s3 업로드
        s3_upload_result = await upload_file_to_s3(upload_file, s3_key, file_name, file_path)
        results.append(s3_upload_result)

        # 문서 저장
        document_id = await process_document(
                    file_name=file_name,
                    file_path=file_path,
                    file_content=file_content,
                    user_id=current_user.id,
                    db=db,
                    s3_key=s3_key
                )

        # 디렉토리 테이블에 저장할 데이터 준비
        directory_value_dict = {
            "id": document_id,
            "name": file_name,
            "path": file_path,
            "is_directory": False,
            "parent_id": parent_id,
            "created_at": datetime.now().isoformat()
        }

        # 디렉토리 테이블에 정보 저장
        results.append(store_directory_table(db, directory_value_dict))

    return results


def process_directory_operations(operations, user_id, db):
    """디렉토리 작업 처리 (생성, 이동, 삭제 등)"""
    from db import crud
    results = []
    
    for op in operations:
        op_type = op.get("operation_type")
        reserved_item_id = op.get("item_id", None)
        reserved_item_name = op.get("name", None)
        reserved_path = op.get("path", "/")
        if op.get("path", "/") == "":
            reserved_path = "/"

        try:
            # 새 폴더 생성
            if op_type == "create":
                new_folder_id = str(uuid.uuid4())
                
                # 경로 정규화
                if not reserved_path.endswith("/"):
                    reserved_path += "/"
                    
                new_path = reserved_path + reserved_item_name
                
                if reserved_path == "/":
                    # 새 폴더를 생성하는 위치가 루트인 경우
                    # 새 폴더의 parent_id는 root이다.
                    parent_id = "root"
                    # 디렉토리 테이블에 저장할 데이터 준비
                    directory_value_dict = {
                        "id": new_folder_id,
                        "name": reserved_item_name,
                        "path": new_path,
                        "is_directory": True,
                        "parent_id": parent_id,
                        "created_at": datetime.now().isoformat(),
                        "operation":op_type
                    }                    
                    # 디렉토리 정보 저장
                    results.append(store_directory_table(db, directory_value_dict))                    
                else:
                    # 새 폴더를 생성하는 위치가 루트가 아닌 경우
                    # 부모 디렉토리 id 가져오는 코드.
                    parent_id = crud.get_parent_id_by_path(db,reserved_path)
                    # 디렉토리 테이블에 저장할 데이터 준비
                    directory_value_dict = {
                        "id": new_folder_id,
                        "name": reserved_item_name,
                        "path": new_path,
                        "is_directory": True,
                        "parent_id": parent_id,
                        "created_at": datetime.now().isoformat(),
                        "operation":op_type
                    }                    
                    # 디렉토리 정보 저장
                    results.append(store_directory_table(db, directory_value_dict))
            
            # 항목 이동
            elif op_type == "move":
                new_path = op.get("new_path", "/")
                # target item의 parent_id 가져오기
                target_item_parent_id = crud.get_parent_id_by_id(db, reserved_item_id)
                # target item의 기존 경로 가져오기
                target_item_path = crud.get_file_path_by_id(db, reserved_item_id)
                # target item의 이름 가져오기
                target_item_name = crud.get_file_name_by_id(db, reserved_item_id)
                # target item의 타입 가져오기
                target_item_type = crud.get_file_is_directory_by_id(db, reserved_item_id)
                # 목적지의 id값 가져오기
                destination_id = crud.get_directory_id_by_path(db, new_path)

                # target item의 새로운 parent_id 준비
                target_new_parent_id = destination_id

                if target_item_parent_id == "root":
                    # target이 root디렉토리에 존재하는 경우
                    if new_path != "/":
                        # new_path가 root가 아닌 경우

                        # target item의 새로운 경로 준비
                        target_new_path = new_path + target_item_path  
                        # target item이 디렉토리인 경우 하위 아이템이 존재한다면 해당 item의 레코드를 반환
                        target_item_children = crud.get_directory_by_parent_id(db, reserved_item_id)
                        if target_item_children:
                            # 하위 아이템이 존재하는 경우
                            # 하위 아이템이 존재하는 경우에는 sql 스크립트를 실행. (자식 아이템까지 재귀적으로 처리됨.)
                            crud.update_directory_with_sql_file_safe(db, reserved_item_id, target_item_path, target_new_path, target_new_parent_id)
                            results.append({
                                            "operation": "move",
                                            "type": "directory" if target_item_type else "file",
                                            "id": reserved_item_id,
                                            "name": target_item_name,
                                            "old_path": target_item_path,
                                            "new_path": target_new_path,
                                            "status": "success"})                            
                        else:
                            # 하위 아이템이 존재하지 않는 경우
                            # 디렉토리 경로 및 부모 id 업데이트
                            crud.update_directory_path_and_parent(db, reserved_item_id, target_new_path, target_new_parent_id)
                            results.append({
                                            "operation": "move",
                                            "type": "directory" if target_item_type else "file",
                                            "id": reserved_item_id,
                                            "name": target_item_name,
                                            "old_path": target_item_path,
                                            "new_path": target_new_path,
                                            "status": "success"})
                            

                    else:
                        # new_path가 root인 경우(이동하지 않음)
                        # 아무 작업도 하지 않음.
                        results.append({
                                        "operation": "move",
                                        "type": "directory" if target_item_type else "file",
                                        "id": reserved_item_id,
                                        "name": target_item_name,
                                        "old_path": target_item_path,
                                        "new_path": new_path,
                                        "status": "success"})
                else:
                    # target이 root디렉토리에 존재하지 않는 경우
                    # target item이 디렉토리인 경우 하위 아이템이 존재한다면 해당 item의 레코드를 반환
                    target_item_children = crud.get_directory_by_parent_id(db, reserved_item_id)
                    # 부모 아이템의 path
                    parent_item_path = crud.get_file_path_by_id(db, target_item_parent_id)                    
                    if new_path != "/":
                        # new_path가 root가 아닌 경우
                        if target_item_children:
                            # 하위 아이템이 존재하는 경우
                            # target item의 새로운 경로 준비
                            target_new_path = new_path + target_item_path.replace(parent_item_path, "")
                            # 디렉토리 경로 및 부모 id 업데이트
                            # 하위 아이템이 존재하는 경우에는 sql 스크립트를 실행. (자식 아이템까지 재귀적으로 처리됨.)
                            crud.update_directory_with_sql_file_safe(db, reserved_item_id, target_item_path, target_new_path, target_new_parent_id)
                            results.append({
                                            "operation": "move",
                                            "type": "directory" if target_item_type else "file",
                                            "id": reserved_item_id,
                                            "name": target_item_name,
                                            "old_path": target_item_path,
                                            "new_path": target_new_path,
                                            "status": "success"})                            
                        else:
                            # 하위 아이템이 존재하지 않는 경우
                            # target item의 새로운 경로 준비
                            target_new_path = new_path + '/' + target_item_name
                            # 디렉토리 경로 및 부모 id 업데이트
                            crud.update_directory_path_and_parent(db, reserved_item_id, target_new_path, target_new_parent_id)
                            results.append({
                                            "operation": "move",
                                            "type": "directory" if target_item_type else "file",
                                            "id": reserved_item_id,
                                            "name": target_item_name,
                                            "old_path": target_item_path,
                                            "new_path": target_new_path,
                                            "status": "success"})                            
                    else:
                        # new_path가 root인 경우
                        if target_item_children:
                            # 하위 아이템이 존재하는 경우
                            # target item의 새로운 경로 준비
                            target_new_path = target_item_path.replace(parent_item_path, "")
                            # 디렉토리 경로 및 부모 id 업데이트
                            # 하위 아이템이 존재하는 경우에는 sql 스크립트를 실행. (자식 아이템까지 재귀적으로 처리됨.)
                            crud.update_directory_with_sql_file_safe(db, reserved_item_id, target_item_path, target_new_path, target_new_parent_id)                            
                            results.append({
                                            "operation": "move",
                                            "type": "directory" if target_item_type else "file",
                                            "id": reserved_item_id,
                                            "name": target_item_name,
                                            "old_path": target_item_path,
                                            "new_path": target_new_path,
                                            "status": "success"})                      
                        else:
                            # 하위 아이템이 존재하지 않는 경우
                            # target item의 새로운 경로 준비
                            target_new_path = new_path + target_item_name
                            # 디렉토리 경로 및 부모 id 업데이트
                            crud.update_directory_path_and_parent(db, reserved_item_id, target_new_path, target_new_parent_id)
                            results.append({
                                            "operation": "move",
                                            "type": "directory" if target_item_type else "file",
                                            "id": reserved_item_id,
                                            "name": target_item_name,
                                            "old_path": target_item_path,
                                            "new_path": target_new_path,
                                            "status": "success"})  

            # 항목 삭제
            elif op_type == "delete":
                
                item_is_directory = crud.get_file_is_directory_by_id(db, reserved_item_id)

                if item_is_directory:
                    # 디렉토리인 경우
                    item_id = reserved_item_id
                    # 디렉토리 삭제
                    crud.delete_directory_by_id(db, item_id)

                    results.append({
                        "operation": "delete",
                        "type": "directory",
                        "id": item_id,
                        "name": item_name,
                        "path": item_path,
                        "status": "success"
                    })
                else:
                    # 파일인 경우
                    item_id = reserved_item_id
                    item_name = crud.get_file_name_by_id(db, item_id)
                    item_path = crud.get_file_path_by_id(db, item_id)                    
                    # s3에서 삭제
                        # 삭제를 위해 s3_key값을 검색해서 가져오기
                    s3_key = crud.get_s3_key_by_id(db, int(item_id))
                        # s3에서 삭제
                    s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=s3_key)

                    # documents 테이블에서 해당 id의 데이터를 삭제하면서 document_chunks, directories 테이블에서 데이터 삭제.
                    crud.delete_document_by_id(db, item_id)

                    results.append({
                        "operation": "delete",
                        "type": "file",
                        "id": item_id,
                        "name": item_name,
                        "path": item_path,
                        "status": "success"
                    })

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


def generate_unique_filename(db: Session, file_name: str) -> str:
    """
    DB에 없는 고유한 파일명을 돌려줍니다.

    Parameters
    ----------
    db : Session
        SQLAlchemy 세션
    file_name : str
        저장하려는 원본 파일 이름 (예: 'report.pdf', 'report(2).pdf')

    Returns
    -------
    str
        DB에 존재하지 않는 새 파일 이름
    """
    import re
    from db import crud
    # 기본 이름·확장자·초기 번호 추출
    m = re.match(r'^(.*?)(?:\((\d+)\))?(\.[^.]+)$', file_name)
    base, num_str, ext = m.group(1), m.group(2), m.group(3)
    next_n = int(num_str) + 1 if num_str else 1

    candidate = file_name  # 우선 그대로 시도
    while crud.get_file_info_by_filename(db, candidate):
        candidate = f"{base}({next_n}){ext}"
        next_n += 1

    return candidate


# 최상위 디렉토리 처리
def process_top_directory(tree, current_upload_path: str, db: Session):
    """최상위 디렉토리 처리"""
    # 라이브러리 임포트
    import json
    from typing import Dict, Any
    from db import crud
    
    top_dir_name, top_dir_children = next(iter(tree.items()))
    top_dir_id = str(uuid.uuid4())

    # 현재 사용자가 업로드 하는 경로가 루트인 경우
    if current_upload_path == '/':
        top_dir_path = current_upload_path+top_dir_name
    else:
        # 현재 사용자가 업로드 하는 경로가 루트가 아닌 특정한 경로인 경우
        top_dir_path = current_upload_path+"/"+top_dir_name
    
    parent_id = crud.get_directory_id_by_path(db, current_upload_path)

    if parent_id is None:
        # 루트 위치에 업로드 하는 경우
        # 부모 아이디를 "root"로 설정.
        parent_id = "root"


    top_dir_results = {
        "id": top_dir_id,
        "name": top_dir_name,
        "path": top_dir_path,
        "is_directory": True,
        "parent_id": parent_id,
        "created_at": datetime.now().isoformat()
    }
    
    
    return top_dir_results, top_dir_children


def store_directory_table(db: Session, value_dict: dict):
    """디렉토리 테이블에 디렉토리 정보를 저장"""
    from db import crud

    # 디렉토리 / 파일 구분
    if value_dict["is_directory"] == True:
        type = "directory"
    else:
        type = "file"

    try:
        if value_dict["operation"] == "create":
            crud.create_directory(
                db=db,
                id=value_dict["id"],
                name=value_dict["name"],
                path=value_dict["path"],
                is_directory=value_dict["is_directory"],
                parent_id=value_dict["parent_id"],
                created_at=value_dict["created_at"]
            )
            return {
                "operation": "create",
                "type": "directory",
                "id": value_dict["id"],
                "name": value_dict["name"],
                "path": value_dict["path"],
                "status": "success"
            }
        else:           
            crud.create_directory(
                db=db,
                id=value_dict["id"],
                name=value_dict["name"],
                path=value_dict["path"],
                is_directory=value_dict["is_directory"],
                parent_id=value_dict["parent_id"],
                created_at=value_dict["created_at"]
            )
            return {
                "type": type,
                "id": value_dict["id"],
                "name": value_dict["name"],
                "path": value_dict["path"],
                "status": "success"
            }
    except Exception as e:
        return {
            "type": type,
            "id": value_dict["id"],
            "name": value_dict["name"],
            "path": value_dict["path"],
            "status": "error",
            "error": str(e)
        }
    
def set_filename(upload_file: any, db: Session):
    """파일 이름 추출"""
    from db import crud
    if os.path.dirname(upload_file.filename) == "":
        # 단일파일인 경우
        file_name = upload_file.filename
    else:
        # 단일파일이 아닌 경우 (경로 데이터가 파일명에 포함되어 있는 경우)
        file_name = os.path.basename(upload_file.filename)
    
    # 동일한 파일이 db에 존재하는 지 확인
    file_info = crud.get_file_info_by_filename(db, file_name)
    if file_info:
        # 중복 파일명 처리
        file_name = generate_unique_filename(db, file_name)
    return file_name

# 필요 없는 함수가 맞으면 바로 삭제.
# def set_s3_key(db: Session, file_name: str, current_user: User):
#     """s3 key 생성"""
#     from db import crud
#     # 파일 이름으로 documents 테이블에 파일이 존재하는 지 확인
#     file_info = crud.get_file_info_by_filename(db, file_name)
#     if file_info:
#         # 중복 파일명 처리
#         file_name = generate_unique_filename(db, file_name)
#     else:
#         # 기존 파일명으로 s3 key 설정.
#         s3_key = f"uploads/{current_user.username}/{file_name}"
#     return s3_key


def set_file_path(file_name: str, upload_file: any, current_upload_path: str):
    """파일 경로 설정"""

    if os.path.dirname(upload_file.filename) == "":
        # 단일파일인 경우
        if current_upload_path == '/':
            # 루트 위치 업로드인 경우
            file_path_full = current_upload_path+file_name
            file_path_dir = current_upload_path
        else:
            # 특정 위치 업로드인 경우
            file_path_full = current_upload_path+"/"+file_name
            file_path_dir = current_upload_path
    else:
        # 단일파일이 아닌 경우 (경로 데이터가 파일명에 포함되어 있는 경우)
        # 파일 이름과 경로 이름 분리
        dir_name =os.path.dirname(upload_file.filename)
        
        if current_upload_path == '/':
            # 루트 위치 업로드인 경우
            file_path_full = "/" +dir_name+"/"+file_name
            file_path_dir = "/" +dir_name
        else:
            # 특정 위치 업로드인 경우
            file_path_full = current_upload_path+"/"+dir_name+"/"+file_name
            file_path_dir = current_upload_path+"/"+dir_name

    return (file_path_full, file_path_dir)



async def upload_file_to_s3(upload_file: any, s3_key: str, file_name: str, file_path: str):
    """s3 업로드"""
    try:
        s3_client.upload_fileobj(
            Fileobj=upload_file.file,
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            ExtraArgs={'ContentType': upload_file.content_type}
        )
        return {
            "type": "file",
            "id": None,
            "name": file_name,
            "path": file_path,
            "status": "success"
        }
    except Exception as e:
        return {
            "type": "file",
            "id": None,
            "name": file_name,
            "path": file_path,
            "status": "error",
            "error": str(e)
        }
