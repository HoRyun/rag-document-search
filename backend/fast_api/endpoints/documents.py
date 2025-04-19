from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
import uuid
import json
import boto3

from db.database import get_db
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

# # 디렉토리 항목을 위한 Pydantic 모델
# class DirectoryItem(BaseModel):
#     id: str
#     name: str
#     path: str
#     is_directory: bool

# # 디렉토리 작업을 위한 모델
# class DirectoryOperation(BaseModel):
#     operation_type: str  # 'create', 'move', 'delete', 'rename'
#     item_id: Optional[str] = None
#     name: Optional[str] = None
#     path: Optional[str] = None
#     new_path: Optional[str] = None

# 임시 스토리지 (실제 구현에서는 DB를 사용)
# filesystem = {
#     "home": {
#         "id": "home",
#         "name": "Home",
#         "path": "/",
#         "is_directory": True,
#         "parent_id": None,
#         "created_at": datetime.now().isoformat()
#     }
# }

@router.get("/")
def list_items(
    path: str = Query("/", description="현재 경로"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
    ):
    """지정된 경로의 파일 및 폴더 목록을 반환"""
    # 현재 이 함수는 에러가 발생하는데, 프로그램 실행에 영향을 주지는 않으니 일단 두기.
    ## develop-clud ver: 
    # try:
    #     documents = get_all_documents(db)
    #     return {"documents": [
    #         {
    #             "id": doc.id,
    #             "filename": doc.filename,
    #             "s3_url": f"https://{S3_BUCKET_NAME}.s3.{AWS_DEFAULT_REGION}.amazonaws.com/{doc.s3_key}",  # URL 동적 생성
    #             "uploaded_at": doc.upload_time.isoformat()
    #         } for doc in documents
    #     ]}
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")
    from db import crud
    try:
        filtered_items = []
        
        #로직.
        # 디렉토리 구조 가져오기
        directories = crud.get_specific_directory(db, path, is_directory=True)
        # 
        # 파일 구조 가져오기
        files = crud.get_specific_directory(db, path, is_directory=False)

        # directories에서 필요한 키만 뽑아 추가
        for d in directories:
            filtered_items.append({
                "id":   d["id"],
                "name": d["name"],
                "path": d["path"],
                "type": d["type"],
            })
        
        # files에서 필요한 키만 뽑아 추가
        for f in files:
            filtered_items.append({
                "id":   f["id"],
                "name": f["name"],
                "path": f["path"],
                "size": f["size"],
                "type": f["type"],
            })

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
                ops_data = json.loads(operations)
                op_results = process_directory_operations(ops_data, current_user.id, db)
                results["items"].extend(op_results)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid operations format")
        
        return results
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error managing documents: {str(e)}")
    #     # 1. 필수 필드 검증
    #     # 업로드 된 파일과 현재 로그인 된 사용자가 실제 존재하는 지 검증
    #     # if not file.filename:
    #     #     raise ValueError("파일 이름이 없습니다.")
    #     # if not current_user.username:
    #     #     raise ValueError("사용자 이름이 없습니다.")


    #     for single_file in files:
    #         code = await process_document(single_file, current_user.id, db)

    #     # # 2. 문서 처리
    #     # # db에 문서 정보를 저장하고 문서를 인덱싱하여 vector store에 저장한다.
    #     # code = await process_document(file, current_user.id, db)



            # # 3. s3에 파일 업로드
            # # 문서 처리 후에 파일 원본을 s3에 업로드한다.
            #     # S3 키 생성 (사용자 이름 기반)
            # s3_key = f"uploads/{current_user.username}/{single_file.filename}"
            #     # s3에 파일 업로드
            # s3_client.upload_fileobj(
            #     Fileobj=single_file.file,
            #     Bucket=S3_BUCKET_NAME,
            #     Key=s3_key,
            #     ExtraArgs={'ContentType': single_file.content_type}
            # )

    #     return JSONResponse(
    #         content={
    #             "code": 200,
    #             "message": "파일 업로드 성공",
    #             "results": [{
    #                 "filename": single_file.filename,
    #                 "s3_url": f"https://{S3_BUCKET_NAME}.s3.{os.getenv('AWS_DEFAULT_REGION')}.amazonaws.com/{s3_key}"
    #             }]
    #         }
    #     )
        
    # except Exception as e:
    #     logger.error(f"파일 업로드 실패: {str(e)}")
    #     return JSONResponse(
    #         status_code=500,
    #         content={
    #             "code": 500,
    #             "message": "파일 업로드 실패",
    #             "error": str(e)
    #         }
    #     )
    # # 파일 업로드 및 처리가 완료되면 성공 메시지를 반환
    # return {
    #     "code": code
    # }

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

# @router.get("/directories")
# async def get_directories(
#     current_user: User = Depends(get_current_user)
# ):
#     """디렉토리 구조 가져오기 엔드포인트"""
#     try:
#         # 실제 구현에서는 DB에서 디렉토리 구조 가져오기
#         directories = list(directory_storage.values())
#         return {"directories": directories}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error fetching directories: {str(e)}")

# @router.post("/sync-directories")
# async def sync_directories(
#     directory_list: DirectoryList,
#     current_user: User = Depends(get_current_user)
# ):
#     """디렉토리 구조를 서버와 동기화하는 엔드포인트"""
#     try:
#         # 실제 구현에서는 DB에 디렉토리 구조 저장
#         for directory in directory_list.directories:
#             directory_storage[directory.id] = {
#                 "id": directory.id,
#                 "name": directory.name,
#                 "path": directory.path
#             }
        
#         return {"message": "Directories synchronized successfully"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error syncing directories: {str(e)}")

# @router.post("/create-directory")
# async def create_directory(
#     name: str = Form(...),
#     path: str = Form("/"),
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db)
# ):
#     """새 폴더 생성 엔드포인트"""
#     try:
#         # 폴더 이름으로 고유 ID 생성
#         import uuid
#         dir_id = str(uuid.uuid4())
        
#         # 새 경로 생성
#         new_path = path
#         if not new_path.endswith("/"):
#             new_path += "/"
#         new_path += name
        
#         # 실제 구현에서는 DB에 폴더 정보 저장
#         # 여기서는 임시 디렉토리 저장소에 저장
#         directory_storage[dir_id] = {
#             "id": dir_id,
#             "name": name,
#             "path": new_path
#         }
        
#         return {
#             "id": dir_id,
#             "name": name,
#             "path": new_path,
#             "message": "Directory created successfully"
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error creating directory: {str(e)}")

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
                # S3 업로드 (BytesIO 없이 UploadFile.file 직접 사용)
                s3_key = f"uploads/{current_user.username}/{files[0].filename}"
                s3_client.upload_fileobj(
                    Fileobj=files[0].file,
                    Bucket=S3_BUCKET_NAME,
                    Key=s3_key,
                    ExtraArgs={'ContentType': files[0].content_type}
                )

                # 3. DB 저장 및 문서 처리
                document_id = await process_document(
                    file=files[0],
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
            #이 파일의 parent_id 얻어오는 쿼리문.
            parent_id = crud.get_parent_id(db, str(document_id))

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
                    file_path= f"{current_path.rstrip('/')}/{file_name}" 
                    # file_path = os.path.join(current_path, file_name)  #* 변경된 부분
                    # DB 저장: 파일
                    
                    document_id = None
                    # <복붙>
                    try:
                        # <s3업로드 예외 처리 try except>
                        try:
                            # S3 업로드 (BytesIO 없이 UploadFile.file 직접 사용)
                            s3_key = f"uploads/{current_user.username}/{upload_file.filename}"
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
                                "name": upload_file.filename,
                                "path": path,
                                "status": "error",
                                "error": str(e)
                            })
                        # </<s3업로드 예외 처리 try except>>

                        # 3. DB 저장 및 문서 처리
                        document_id = await process_document(
                            file=upload_file,
                            user_id=current_user.id,
                            db=db,
                            s3_key=s3_key
                        )
                        # </s3업로드, 파일 처리 및 return 예외 처리>
                    
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

# 이 함수는 버그 잡고 연결 하기.
def process_directory_operations(operations, user_id, db):
    pass

    # """디렉토리 작업 처리 (생성, 이동, 삭제 등)"""
    # results = []
    
    # for op in operations:
    #     op_type = op.get("operation_type")
        
    #     try:
    #         # 새 폴더 생성
    #         if op_type == "create":
    #             dir_id = str(uuid.uuid4())
    #             path = op.get("path", "/")
    #             name = op.get("name")
                
    #             # 경로 정규화
    #             if not path.endswith("/"):
    #                 path += "/"
                    
    #             new_path = path + name
                
    #             # 디렉토리 정보 저장
    #             filesystem[dir_id] = {
    #                 "id": dir_id,
    #                 "name": name,
    #                 "path": new_path,
    #                 "is_directory": True,
    #                 "parent_id": None,  # 실제 구현에서는 부모 디렉토리 ID 설정
    #                 "created_at": datetime.now().isoformat()
    #             }
                
    #             results.append({
    #                 "operation": "create",
    #                 "type": "directory",
    #                 "id": dir_id,
    #                 "name": name,
    #                 "path": new_path,
    #                 "status": "success"
    #             })
            
    #         # 항목 이동
    #         elif op_type == "move":
    #             item_id = op.get("item_id")
    #             new_path = op.get("new_path")
                
    #             if item_id in filesystem:
    #                 # 디렉토리인 경우
    #                 item = filesystem[item_id]
    #                 old_path = item["path"]
                    
    #                 # 경로 업데이트
    #                 item["path"] = new_path
    #                 filesystem[item_id] = item
                    
    #                 # TODO: 실제 구현에서는 DB에서 경로 업데이트
                    
    #                 results.append({
    #                     "operation": "move",
    #                     "type": "directory" if item["is_directory"] else "file",
    #                     "id": item_id,
    #                     "name": item["name"],
    #                     "old_path": old_path,
    #                     "new_path": new_path,
    #                     "status": "success"
    #                 })
    #             else:
    #                 # TODO: 파일인 경우 DB에서 경로 업데이트
                    
    #                 results.append({
    #                     "operation": "move",
    #                     "id": item_id,
    #                     "new_path": new_path,
    #                     "status": "not_found",
    #                     "error": "Item not found"
    #                 })
            
    #         # 항목 삭제
    #         elif op_type == "delete":
    #             item_id = op.get("item_id")
                
    #             if item_id in filesystem:
    #                 # 디렉토리인 경우
    #                 item = filesystem[item_id]
    #                 del filesystem[item_id]
                    
    #                 # TODO: 실제 구현에서는 DB에서 항목 삭제
                    
    #                 results.append({
    #                     "operation": "delete",
    #                     "type": "directory" if item["is_directory"] else "file",
    #                     "id": item_id,
    #                     "name": item["name"],
    #                     "path": item["path"],
    #                     "status": "success"
    #                 })
    #             else:
    #                 # TODO: 파일인 경우 DB에서 삭제
                    
    #                 results.append({
    #                     "operation": "delete",
    #                     "id": item_id,
    #                     "status": "not_found",
    #                     "error": "Item not found"
    #                 })
            
    #         # 항목 이름 변경
    #         elif op_type == "rename":
    #             item_id = op.get("item_id")
    #             new_name = op.get("name")
                
    #             if item_id in filesystem:
    #                 # 디렉토리인 경우
    #                 item = filesystem[item_id]
    #                 old_name = item["name"]
                    
    #                 # 이름 업데이트
    #                 item["name"] = new_name
                    
    #                 # 경로도 업데이트
    #                 path_parts = item["path"].rsplit("/", 1)
    #                 if len(path_parts) > 1:
    #                     item["path"] = path_parts[0] + "/" + new_name
    #                 else:
    #                     item["path"] = "/" + new_name
                    
    #                 filesystem[item_id] = item
                    
    #                 # TODO: 실제 구현에서는 DB에서 이름 업데이트
                    
    #                 results.append({
    #                     "operation": "rename",
    #                     "type": "directory" if item["is_directory"] else "file",
    #                     "id": item_id,
    #                     "old_name": old_name,
    #                     "new_name": new_name,
    #                     "path": item["path"],
    #                     "status": "success"
    #                 })
    #             else:
    #                 # TODO: 파일인 경우 DB에서 이름 업데이트
                    
    #                 results.append({
    #                     "operation": "rename",
    #                     "id": item_id,
    #                     "new_name": new_name,
    #                     "status": "not_found",
    #                     "error": "Item not found"
    #                 })
            
    #         else:
    #             results.append({
    #                 "operation": op_type,
    #                 "status": "error",
    #                 "error": f"Unknown operation type: {op_type}"
    #             })
        
    #     except Exception as e:
    #         results.append({
    #             "operation": op_type,
    #             "status": "error",
    #             "error": str(e)
    #         })
    
    # return results


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
