from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional

import logging
from datetime import datetime

# 메서드 import
from debug import debugging
from db.database import get_db
from db.models import User
from fast_api.security import get_current_user
from llm import invoke
from fast_api.endpoints import op_schemas

import uuid
import re


router = APIRouter()

# 로깅 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@router.post("/stage", response_model=op_schemas.StageOperationResponse)
async def stage_operation(
    request: op_schemas.StageOperationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    accept_language: Optional[str] = Header(default=None, alias="Accept-Language")
):
    """
    자연어 명령을 분석하고 작업을 준비하는 엔드포인트
    
    Args:
        request: 사용자 명령과 컨텍스트 정보
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션
        accept_language: Accept-Language header
    
    Returns:
        OperationResponse: 준비된 작업 정보
    """
    logger.info(f"Stage operation request from user {current_user.id}: {request.command}")
    # Extract language from Accept-Language header (default to 'ko')
    language = accept_language.split(',')[0].strip().lower() if accept_language else 'ko'
    logger.debug(f"🈯 Detected language from header: {language}")

    # TODO: Pass `language` to downstream logic (LLM prompt, i18n, etc.) as needed.

    # command 값 접근
    command = request.command

    # context 값 접근
    context = request.context

    # context의 하위 아이템 접근
    current_path = context.currentPath
    selected_files = context.selectedFiles
    available_folders = context.availableFolders
    timestamp = context.timestamp

    # 타입을 결정.
    operation_result = invoke.get_operation_type(command)
    # 타입 결정 결과 분류.
    operation_type = operation_result["value"]
    error_type = operation_result.get("value_type", None)

    # 타입 별 AI 호출 분기. 각 함수의 매개변수로 command, context전달.
    if operation_type == "move":
        result = await process_move(command, context)
    elif operation_type == "copy":
        result = await process_copy(command, context)
    elif operation_type == "delete":
        result = process_delete(command, context)
    elif operation_type == "rename":
        result = process_rename(command, context)
    elif operation_type == "create_folder":
        result = process_create_folder(command, context)
    elif operation_type == "search":
        result = process_search(command)
    elif operation_type == "summarize":
        result = process_summarize(command, context)
    elif operation_type == "error":
        result = process_error(command, context, error_type)


    # 결과 반환
    return result

@router.post("/{operation_id}/execute", response_model=op_schemas.ExecutionResponse)
async def execute_operation(
    operation_id: str,
    request: op_schemas.ExecuteOperationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    준비된 작업을 실행하는 엔드포인트
    
    Args:
        operation_id: 실행할 작업의 ID
        request: 사용자 확인 및 옵션
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션
    
    Returns:
        ExecutionResponse: 실행 결과 정보
    """
    logger.info(f"Execute operation {operation_id} for user {current_user.id}")
    # debugging.stop_debugger()
    
    # TODO: 실제 로직 구현
    pass

@router.post("/{operation_id}/cancel", response_model=op_schemas.BasicResponse)
async def cancel_operation(
    operation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    준비된 작업을 취소하는 엔드포인트
    
    Args:
        operation_id: 취소할 작업의 ID
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션
    
    Returns:
        BasicResponse: 취소 결과 메시지
    """
    logger.info(f"Cancel operation {operation_id} for user {current_user.id}")
    
    # TODO: 실제 로직 구현
    pass

@router.post("/{operation_id}/undo", response_model=op_schemas.BasicResponse)
async def undo_operation(
    operation_id: str,
    request: op_schemas.UndoOperationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    실행된 작업을 되돌리는 엔드포인트
    
    Args:
        operation_id: 되돌릴 작업의 ID
        request: 되돌리기 사유 및 시간
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션
    
    Returns:
        BasicResponse: 되돌리기 결과 메시지
    """
    logger.info(f"Undo operation {operation_id} for user {current_user.id}, reason: {request.reason}")
    
    # TODO: 실제 로직 구현
    pass


# operation_type별 function 만들기

async def process_move(command, context):
    """
    이동 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """
    # 명령 분석
    destination = get_destination(command, context, 'move')
    # 작업 설명 요약 생성.
    description = get_description(context, destination, 'move')


    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
    
    # destination 파싱. 만약 '/'로 파싱 시 'create_folder'가 존재하는 경우,
    # destination에서 'create_folder' 문자열이 있으면 제거
    if destination.startswith('create_folder'):
        code_remove_ver = destination.replace('create_folder', '', 1)

        # destination에 코드를 제거한 경로 데이터 저장.
        destination = code_remove_ver

        additional_desc = code_remove_ver + " 폴더를 생성합니다."
        # 추가 설명 문장 추가.
        description += " "+ additional_desc
    else:
        destination = destination
        description = description
    
    warnings = [] 
    
    # StageOperationResponse 객체 생성
    return op_schemas.StageOperationResponse(
        operationId=operationId,
        operation={
            "type": "move",
            "targets": context.selectedFiles,
            "destination": destination
        },
        requiresConfirmation=True,
        riskLevel="medium",
        preview={
            "description": description,
            "warnings": warnings
        }
    )

async def process_copy(command, context):
    """
    복사 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """
    # 명령 분석
    destination = get_destination(command, context, 'copy')
    # 작업 설명 요약 생성.
    description = get_description(context, destination, 'copy')


    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
    
    # destination 파싱. 만약 '/'로 파싱 시 'create_folder'가 존재하는 경우,
    # destination에서 'create_folder' 문자열이 있으면 제거
    if destination.startswith('create_folder'):
        code_remove_ver = destination.replace('create_folder', '', 1)

        # destination에 코드를 제거한 경로 데이터 저장.
        destination = code_remove_ver

        additional_desc = code_remove_ver + " 폴더를 생성합니다."
        # 추가 설명 문장 추가.
        description += " "+ additional_desc
    else:
        destination = destination
        description = description
    
    warnings = [] 
    
    # StageOperationResponse 객체 생성
    return op_schemas.StageOperationResponse(
        operationId=operationId,
        operation={
            "type": "copy",
            "targets": context.selectedFiles,
            "destination": destination
        },
        requiresConfirmation=True,
        riskLevel="low",
        preview={
            "description": description,
            "warnings": warnings
        }
    )

def process_delete(command, context):
    """
    삭제 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """
    # 작업 설명 요약 생성.
    description = get_description(context, None, 'delete')


    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
    warnings = [] 
    
    # StageOperationResponse 객체 생성
    return op_schemas.StageOperationResponse(
        operationId=operationId,
        operation={
            "type": "delete",
            "targets": context.selectedFiles
        },
        requiresConfirmation=True,
        riskLevel="high",
        preview={
            "description": description,
            "warnings": warnings
        }
    )

def process_error(command, context, error_type):
    """
    오류 상황을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        error_type: 에러 타입 (err-1 또는 err-2)
        
    Returns:
        에러 정보를 담은 결과 객체
    """
    # 데이터 준비
    operation_id = "error-"+str(uuid.uuid4())
    
    # 에러 타입별 메시지 및 가이드 설정
    if error_type == "err-1":
        # 부정표현 또는 파일관련이지만 매칭안됨
        message = "명령을 이해할 수 없습니다. 다시 입력해주세요."
        description = f"입력하신 명령 '{command}'을(를) 처리할 수 없습니다."
        warnings = ["'파일 이동', '파일 복사', '파일 삭제' 등의 명령어를 사용해보세요."]
    elif error_type == "err-2":
        # 파일과 관련없는 명령
        message = "파일 관리와 관련없는 명령입니다."
        description = f"입력하신 명령 '{command}'은(는) 파일 관리와 관련이 없습니다."
        warnings = ["이 시스템은 파일 관리를 위한 도구입니다.", 
                    "'파일 검색', '폴더 생성' 등의 명령어를 사용해보세요."]
    else:
        # 기본 에러 메시지
        message = "알 수 없는 오류가 발생했습니다."
        description = "시스템에서 오류가 발생했습니다."
        warnings = ["잠시 후 다시 시도해주세요."]
    
    # 로그 기록
    logger.warning(f"Error processing command: '{command}', Error type: {error_type}")
    
    # StageOperationResponse 객체 생성
    return op_schemas.StageOperationResponse(
        operationId=operation_id,
        operation={
            "type": "error",
            "error_type": error_type,
            "message": message
        },
        requiresConfirmation=False,
        riskLevel="none",
        preview={
            "description": description,
            "warnings": warnings
        }
    )

def process_rename(command, context):
    """
    이름 변경 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """

    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
    new_name = get_new_name(command)
    description = generate_rename_description(context, new_name)
    # debugging.stop_debugger()

    # StageOperationResponse 객체 생성
    return op_schemas.StageOperationResponse(
        operationId=operationId,
        operation={
            "type": "rename",
            "target": context.selectedFiles,
            "newName": new_name
        },
        requiresConfirmation=True,
        riskLevel="medium",
        preview={
            "description": description
        }
    )

def process_create_folder(command, context):
    """
    폴더 생성 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """
    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
    folder_name = get_new_folder_name(command)
    parent_Path = get_parent_path(command, context)
    description = generate_create_folder_description(folder_name, parent_Path)

    # parent_Path 파싱. 만약 'create_folder'가 존재하는 경우,
    # parent_Path에서 'create_folder' 문자열이 있으면 제거
    if parent_Path.startswith('create_folder'):
        code_remove_ver = parent_Path.replace('create_folder', '', 1)

        # parent_Path에 코드를 제거한 경로 데이터 저장.
        parent_Path = code_remove_ver

        additional_desc = folder_name + " 폴더를 생성합니다."
        # 추가 설명 문장 추가.
        description += " " + additional_desc

    # StageOperationResponse 객체 생성
    return op_schemas.StageOperationResponse(
        operationId=operationId,
        operation={
            "type": "create_folder",
            "folderName": folder_name,
            "parentPath": parent_Path
        },
        requiresConfirmation=True,
        riskLevel="low",
        preview={
            "description": description
        }
    )

def process_search(command):
    """
    검색 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        
    Returns:
        작업 결과 정보
    """
    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
    search_term = get_search_term(command)
    description = generate_search_description(search_term)

    # StageOperationResponse 객체 생성
    return op_schemas.StageOperationResponse(
        operationId=operationId,
        operation={
            "type": "search",
            "searchTerm": search_term
        },
        requiresConfirmation=False,
        riskLevel="low",
        preview={
            "description": description
        }
    )

def process_summarize(command, context):
    """
    요약 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """

    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
    description = generate_summarize_description(context)

    # StageOperationResponse 객체 생성
    return op_schemas.StageOperationResponse(
        operationId=operationId,
        operation={
            "type": "summarize",
            "targets": context.selectedFiles
        },
        requiresConfirmation=True,
        riskLevel="low",
        preview={
            "description": description
        }
    )





def get_destination(command, context, operation_type):
    """
    목적지 경로를 결정하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        operation_type: 작업 타입 ('move' 또는 'copy')
    
    Returns:
        str: 목적지 경로
    """

    # 목적지 경로 추출
    if operation_type == 'move':
        output_destination = extract_move_destination(command, context)
    elif operation_type == 'copy':
        # copy 로직은 나중에 구현
        output_destination = extract_copy_destination(command, context)
    # ...

    return output_destination

def get_description(context, destination = '/', operation_type = "default", new_name = None):
    """
    
    
    Returns:
        str: output_description
    """
    if operation_type == 'move':
        output_description = generate_move_description(context, destination)
    elif operation_type == 'copy':
        output_description = generate_copy_description(context, destination)
    elif operation_type == 'delete':
        output_description = generate_delete_description(context)
    elif operation_type == 'rename':
        output_description = generate_rename_description(context, new_name)
    else:
        output_description = "작업 설명 문장 생성 오류"

    return output_description

def extract_move_destination(command, context):
    """
    이동 작업에 대한 목적지를 추출하는 함수
    
    Args:
        command: 사용자의 자연어 명령
    """
    # 1. 사용자 명령에서 목적지 추출
    input_destination = None
    
    # 다양한 패턴으로 목적지 추출 시도
    patterns = [
        r'(\w+)\s*폴더로',  # "마케팅 폴더로"
        r'(\w+)\s*폴더에', # "마케팅 폴더에"
        r'(\w+)로\s*이동',  # "마케팅로 이동"
        r'(\w+)에\s*이동',  # "마케팅에 이동"
        r'(\w+)\s*디렉토리로', # "마케팅 디렉토리로"
        r'(\w+)\s*디렉토리에', # "마케팅 디렉토리에"
        r'로\s*옮겨.*?(\w+)', # "로 옮겨 마케팅"
        r'에\s*옮겨.*?(\w+)', # "에 옮겨 마케팅"
    ]
    
    # 각 패턴을 순서대로 시도하여 목적지 추출
    for pattern in patterns:
        match = re.search(pattern, command)
        if match:
            input_destination = match.group(1)
            break  # 첫 번째 매칭되는 패턴에서 중단
    
    # 2. availableFolders에서 매칭되는 path 찾기
    if input_destination:
        for folder in context.availableFolders:
            if folder.get('name') == input_destination:
                output_destination = folder.get('path')
                return output_destination
    
    # 매칭되는 폴더가 없는 경우 output_destination에 'create_folder' 코드 추가.
    if context.availableFolders:
        output_destination = 'create_folder'+'/'+input_destination
    else:
        output_destination = '/'
    
    return output_destination

def generate_move_description(context, destination):
    """
    이동 작업에 대한 설명 문장을 생성하는 함수

    Args:
        context: 작업 컨텍스트 정보 (selectedFiles 포함)
        destination: 목적지 경로 ('create_folder/폴더명' 형태일 수 있음)
        
    Returns:
        str: "파일명들을 목적지로 이동합니다." 형태의 설명 문장
    """
    # 1. selectedFiles 값 준비
    # selectedFiles 리스트의 각 아이템 객체의 name키의 값을 나열하여 저장
    file_names = []
    for file in context.selectedFiles:
        file_names.append(file.get('name', ''))
    st_result = ', '.join(file_names)

    # 2. destination 값 파싱
    # destination에서 'create_folder' 문자열이 있으면 제거
    if destination.startswith('create_folder'):
        ds_result = destination.replace('create_folder', '', 1)
    else:
        ds_result = destination
    
    # 3. description 문장 생성
    desc_result = st_result + "를 " + ds_result + "로 이동합니다."

    return desc_result

def extract_copy_destination(command, context):
    """
    복사 작업에 대한 목적지를 추출하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
    
    Returns:
        str: 목적지 경로
    """
    # 1. 사용자 명령에서 목적지 추출
    input_destination = None
    
    # 다양한 패턴으로 목적지 추출 시도 (복사 작업에 맞는 패턴 포함)
    patterns = [
        r'(\w+)\s*폴더로',  # "마케팅 폴더로"
        r'(\w+)\s*폴더에', # "마케팅 폴더에"
        r'(\w+)로\s*복사',  # "마케팅로 복사"
        r'(\w+)에\s*복사',  # "마케팅에 복사"
        r'(\w+)\s*디렉토리로', # "마케팅 디렉토리로"
        r'(\w+)\s*디렉토리에', # "마케팅 디렉토리에"
        r'로\s*백업.*?(\w+)', # "로 백업 마케팅"
        r'에\s*백업.*?(\w+)', # "에 백업 마케팅"
        r'(\w+)\s*폴더에\s*백업', # "마케팅 폴더에 백업"
        r'(\w+)\s*폴더로\s*백업', # "마케팅 폴더로 백업"
    ]
    
    # 각 패턴을 순서대로 시도하여 목적지 추출
    for pattern in patterns:
        match = re.search(pattern, command)
        if match:
            input_destination = match.group(1)
            break  # 첫 번째 매칭되는 패턴에서 중단
    
    # 2. availableFolders에서 매칭되는 path 찾기
    if input_destination:
        for folder in context.availableFolders:
            if folder.get('name') == input_destination:
                output_destination = folder.get('path')
                return output_destination
    
    # 매칭되는 폴더가 없는 경우 output_destination에 'create_folder' 코드 추가.
    if context.availableFolders:
        output_destination = 'create_folder'+'/'+input_destination
    else:
        output_destination = '/'
    
    return output_destination

def generate_copy_description(context, destination='/'):
    """
    복사 작업에 대한 설명 문장을 생성하는 함수

    Args:
        context: 작업 컨텍스트 정보 (selectedFiles 포함)
        destination: 목적지 경로 ('create_folder/폴더명' 형태일 수 있음)
        
    Returns:
        str: "파일명들을 목적지로 복사합니다." 형태의 설명 문장
    """
    # 1. selectedFiles 값 준비
    # selectedFiles 리스트의 각 아이템 객체의 name키의 값을 나열하여 저장
    file_names = []
    for file in context.selectedFiles:
        file_names.append(file.get('name', ''))
    st_result = ', '.join(file_names)

    # 2. destination 값 파싱
    # destination에서 'create_folder' 문자열이 있으면 제거
    if destination.startswith('create_folder'):
        ds_result = destination.replace('create_folder', '', 1)
    else:
        ds_result = destination
    
    # 3. description 문장 생성 (복사 작업에 맞게 수정)
    desc_result = st_result + "를 " + ds_result + "로 복사합니다."

    return desc_result

def generate_delete_description(context):
    """
    삭제 작업에 대한 설명 문장을 생성하는 함수
    
    Args:
        context: 작업 컨텍스트 정보 (selectedFiles 포함)
        
    Returns:
        str: "선택한 X개 항목 (파일Y, 폴더 Z) 을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다." 형태의 설명 문장
    """
    # 1. selectedFiles에서 파일과 폴더 개수 세기
    file_count = 0
    folder_count = 0
    
    for item in context.selectedFiles:
        item_type = item.get('type', '')
        if item_type == 'folder':
            folder_count += 1
        else:
            file_count += 1
    
    # 2. 전체 항목 개수 계산
    total_count = file_count + folder_count
    
    # 3. 항목 타입별 설명 문구 생성
    type_description_parts = []
    if file_count > 0:
        type_description_parts.append(f"파일{file_count}")
    if folder_count > 0:
        type_description_parts.append(f"폴더 {folder_count}")
    
    type_description = ", ".join(type_description_parts)
    
    # 4. 최종 설명 문장 생성
    desc_result = f"선택한 {total_count}개 항목 ({type_description}) 을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다."

    return desc_result

    
def get_new_name(command):
    """
    이름 변경 작업에 대한 새로운 이름을 추출하는 함수
    
    Args:
        command: 사용자의 자연어 명령
    
    Returns:
        str: 추출된 새로운 이름 (없으면 None)
    """
    # 1. 사용자 명령에서 새 이름 추출
    new_name = None
    
    # 다양한 패턴으로 새 이름 추출 시도
    patterns = [
        r'(\w+?)으로\s*바꿔',  # "새이름으로 바꿔" → "새이름"
        r'(\w+?)으로\s*변경',  # "새이름으로 변경" → "새이름" 
        r'(\w+?)으로\s*수정',  # "새이름으로 수정" → "새이름"
        r'(\w+?)으로\s*이름변경',  # "새이름으로 이름변경" → "새이름"
        r'(\w+?)으로\s*리네임',  # "새이름으로 리네임" → "새이름"
        r'(\w+?)으로\s*rename',  # "새이름으로 rename" → "새이름"
        r'(\w+)로\s*바꿔',  # "새이름로 바꿔"
        r'(\w+)로\s*변경',  # "새이름로 변경"
        r'(\w+)로\s*수정',  # "새이름로 수정"
        r'(\w+)로\s*이름변경',  # "새이름로 이름변경"
        r'(\w+)로\s*리네임',  # "새이름로 리네임"
        r'(\w+)로\s*rename',  # "새이름로 rename" (영어 혼용)
        r'이름을\s*(\w+)로',  # "이름을 새이름로"
        r'이름을\s*(\w+?)으로',  # "이름을 새이름으로" → "새이름"
        r'파일명을\s*(\w+)로',  # "파일명을 새이름로"
        r'파일명을\s*(\w+?)으로',  # "파일명을 새이름으로" → "새이름"
    ]
    
    # 각 패턴을 순서대로 시도하여 새 이름 추출
    for pattern in patterns:
        match = re.search(pattern, command)
        if match:
            new_name = match.group(1)
            break  # 첫 번째 매칭되는 패턴에서 중단
    
    return new_name

def generate_rename_description(context, new_name):
    """
    이름 변경 작업에 대한 설명 문장을 생성하는 함수
    
    Args:
        context: 작업 컨텍스트 정보 (selectedFiles 포함)
        new_name: 새로운 이름
        
    Returns:
        str: "문서 이름을 new_name(으)로 변경합니다." 또는 "디렉토리 이름을 new_name(으)로 변경합니다." 형태의 설명 문장
    """
    # 1. selectedFiles에서 첫 번째 아이템의 타입 확인
    # (rename 작업은 일반적으로 단일 아이템에 대해 수행됨)
    if context.selectedFiles and len(context.selectedFiles) > 0:
        selected_item = context.selectedFiles[0]
        item_type = selected_item.get('type', '')
        
        # 2. 아이템 타입에 따른 설명 문구 생성
        if item_type == 'folder':
            # 폴더(디렉토리)인 경우
            desc_result = f"디렉토리 이름을 {new_name}(으)로 변경합니다."
        else:
            # 파일인 경우 (기본값)
            desc_result = f"문서 이름을 {new_name}(으)로 변경합니다."
    else:
        # 선택된 아이템이 없는 경우 기본 메시지
        desc_result = f"아이템 이름을 {new_name}(으)로 변경합니다."
    
    return desc_result

def get_new_folder_name(command):
    """
    새 폴더 이름을 추출하는 함수
    
    Args:
        command: 사용자의 자연어 명령
    """
    # 1. 사용자 명령에서 새 폴더 이름 추출
    new_dir_name = None
    
    # 다양한 패턴으로 새 폴더 이름 추출 시도
    patterns = [
        # 기본 생성 패턴
        r'(\w+)\s*폴더를\s*생성',  # "신규프로젝트 폴더를 생성"
        r'(\w+)\s*폴더\s*생성',   # "신규프로젝트 폴더 생성"
        r'(\w+)\s*디렉토리를\s*생성',  # "신규프로젝트 디렉토리를 생성"
        r'(\w+)\s*디렉토리\s*생성',   # "신규프로젝트 디렉토리 생성"
        
        # 만들기 패턴
        r'(\w+)\s*폴더를\s*만들',  # "신규프로젝트 폴더를 만들"
        r'(\w+)\s*폴더\s*만들',   # "신규프로젝트 폴더 만들"
        r'(\w+)\s*디렉토리를\s*만들',  # "신규프로젝트 디렉토리를 만들"
        r'(\w+)\s*디렉토리\s*만들',   # "신규프로젝트 디렉토리 만들"
        r'(\w+)를\s*만들어',  # "신규프로젝트를 만들어"
        r'(\w+)\s*만들어',   # "신규프로젝트 만들어"
        
        # 추가 패턴
        r'새\s*(\w+)를\s*추가',  # "새 프로젝트를 추가"
        r'새\s*(\w+)\s*추가',   # "새 프로젝트 추가"
        r'(\w+)를\s*추가',  # "신규프로젝트를 추가"
        r'(\w+)\s*추가',   # "신규프로젝트 추가"
        r'(\w+)\s*폴더를\s*추가',  # "신규프로젝트 폴더를 추가"
        r'(\w+)\s*디렉토리를\s*추가',  # "신규프로젝트 디렉토리를 추가"
        
        # 기본 생성 패턴 (간단한 형태)
        r'(\w+)를\s*생성',  # "신규프로젝트를 생성"
        r'(\w+)\s*생성',   # "신규프로젝트 생성"
        r'새\s*(\w+)를\s*생성',  # "새 프로젝트를 생성"
        r'새\s*(\w+)\s*생성',   # "새 프로젝트 생성"
        
        # '라는/이라는' 패턴
        r'(\w+)라는\s*폴더를\s*생성',  # "프로젝트라는 폴더를 생성"
        r'(\w+)라는\s*폴더\s*생성',   # "프로젝트라는 폴더 생성"
        r'(\w+)라는\s*디렉토리를\s*생성',  # "프로젝트라는 디렉토리를 생성"
        r'(\w+)라는\s*디렉토리\s*생성',   # "프로젝트라는 디렉토리 생성"
        r'(\w+)이라는\s*폴더를\s*생성',  # "프로젝트이라는 폴더를 생성"
        r'(\w+)이라는\s*폴더\s*생성',   # "프로젝트이라는 폴더 생성"
        
        # 새로운/신규 패턴
        r'새로운\s*(\w+)를\s*생성',  # "새로운 프로젝트를 생성"
        r'새로운\s*(\w+)\s*생성',   # "새로운 프로젝트 생성"
        r'신규\s*(\w+)를\s*생성',  # "신규 프로젝트를 생성"
        r'신규\s*(\w+)\s*생성',   # "신규 프로젝트 생성"
        
        # 영어 혼용 패턴
        r'new\s*(\w+)를\s*생성',  # "new 프로젝트를 생성"
        r'new\s*(\w+)\s*생성',   # "new 프로젝트 생성"
        r'(\w+)\s*create',  # "프로젝트 create"
        r'create\s*(\w+)',  # "create 프로젝트"
        
        # 위치 표현과 함께
        r'여기에\s*(\w+)를\s*생성',  # "여기에 프로젝트를 생성"
        r'이곳에\s*(\w+)를\s*생성',  # "이곳에 프로젝트를 생성"
        r'(\w+)를\s*여기에\s*생성',  # "프로젝트를 여기에 생성"
        
        # 기타 표현
        r'(\w+)\s*폴더를\s*구성',  # "프로젝트 폴더를 구성"
        r'(\w+)\s*디렉토리를\s*구성',  # "프로젝트 디렉토리를 구성"
        r'(\w+)\s*이름의\s*폴더를\s*생성',  # "프로젝트 이름의 폴더를 생성"
        r'(\w+)\s*이름으로\s*폴더를\s*생성',  # "프로젝트 이름으로 폴더를 생성"
    ]
    
    # 각 패턴을 순서대로 시도하여 새 폴더 이름 추출
    for pattern in patterns:
        match = re.search(pattern, command)
        if match:
            new_dir_name = match.group(1)
            break  # 첫 번째 매칭되는 패턴에서 중단
    
    return new_dir_name


def get_parent_path(command, context):
    """
    새 폴더의 부모 경로를 추출하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        folder_name: 생성할 폴더 이름(A)
    
    Returns:
        str: 부모 경로 (기존 경로 또는 'create_folder/B' 형태)
    """
    # 1. 현재 위치 관련 패턴 확인 (최우선)
    current_location_patterns = [
        r'현재\s*디렉토리',      # "현재 디렉토리에"
        r'현재\s*위치',         # "현재 위치에" 
        r'현재\s*폴더',         # "현재 폴더에"
        r'이\s*위치',          # "이 위치에"
        r'이\s*폴더',          # "이 폴더에"
        r'여기',              # "여기에"
        r'지금\s*위치',         # "지금 위치에"
        r'이곳'               # "이곳에"
    ]
    
    for pattern in current_location_patterns:
        if re.search(pattern, command):
            return context.currentPath or '/'
    
    # 2. 사용자 명령에서 부모 디렉토리 이름(B) 추출
    parent_dir_name = None
    
    # 다양한 패턴으로 부모 디렉토리 위치 추출 시도
    patterns = [
        r'(\w+)\s*폴더\s*안에',  # "프로젝트 폴더 안에"
        r'(\w+)\s*폴더\s*내에',  # "프로젝트 폴더 내에" 
        r'(\w+)\s*디렉토리\s*안에',  # "프로젝트 디렉토리 안에"
        r'(\w+)\s*디렉토리\s*내에',  # "프로젝트 디렉토리 내에"
        r'(\w+)\s*내에\s*생성',  # "프로젝트 내에 생성" 
        r'(\w+)\s*안에\s*생성',  # "프로젝트 안에 생성"
        r'(\w+)\s*폴더\s*아래',  # "프로젝트 폴더 아래"
        r'(\w+)\s*디렉토리\s*아래',  # "프로젝트 디렉토리 아래"
    ]
    
    # 각 패턴을 순서대로 시도하여 부모 디렉토리 이름 추출
    for pattern in patterns:
        match = re.search(pattern, command)
        if match:
            parent_dir_name = match.group(1)
            break  # 첫 번째 매칭되는 패턴에서 중단
    
    # 3. availableFolders에서 매칭되는 path 찾기
    if parent_dir_name:
        for folder in context.availableFolders:
            if folder.get('name') == parent_dir_name:
                return folder.get('path')  # C 값 반환
        
        # 매칭되는 폴더가 없는 경우 'create_folder/B' 반환
        return 'create_folder/' + parent_dir_name
    
    # 부모 디렉토리가 명시되지 않은 경우 현재 경로 사용
    return context.currentPath or '/'

def generate_create_folder_description(folder_name, parent_path):
    """
    폴더 생성 작업에 대한 설명 문장을 생성하는 함수
    
    Args:
        folder_name: 생성할 폴더 이름
        parent_path: 폴더 생성 위치
            
    Returns:
        str: 폴더 생성 작업에 대한 설명 문장
    """
    # parent_path에 'create_folder' 문자열이 포함되어 있는지 확인
    if 'create_folder' in parent_path:
        # 'create_folder/'를 제거한 값을 parent_dir_name에 할당
        parent_dir_name = parent_path.replace('create_folder/', '')
    else:
        # parent_path를 '/'로 split하고 가장 마지막 경로 문자열을 가져옴
        path_parts = parent_path.strip('/').split('/')
        # 빈 문자열이거나 루트 경로인 경우 처리
        if path_parts and path_parts[0]:
            parent_dir_name = path_parts[-1]
        else:
            parent_dir_name = '루트'
    
    # 결과 문자열 생성
    result_desc = f"{parent_dir_name} 내에 {folder_name} 폴더를 생성합니다."
    
    return result_desc


def get_search_term(command):
    """
    사용자의 명령에서 검색하고 싶은 내용을 추출한다.
    
    Args:
        command: 사용자의 자연어 명령
        
    Returns:
        str: 추출된 검색 키워드
    """
    # 1. 파일명 검색 패턴 (확장자 포함) - 이것은 그대로 유지
    filename_pattern = r'([^\s]+\.\w+)'
    filename_match = re.search(filename_pattern, command)
    if filename_match:
        return filename_match.group(1)
    
    # 2. 검색 명령어와 불필요한 부분 제거
    search_term = clean_search_command(command)
    
    return search_term

def clean_search_command(command):
    """
    검색 명령에서 불필요한 명령어 부분만 제거하고 
    중요한 검색 키워드와 컨텍스트는 유지한다.
    
    Args:
        command: 원본 명령어
        
    Returns:
        str: 정리된 검색어
    """
    # 제거할 명령어 패턴들 (순서 중요)
    remove_patterns = [
        # 문장 끝 패턴들 (물음표 포함)
        r'\s*찾아\s*줘?\s*\??$',
        r'\s*검색\s*해?\s*줘?\s*\??$',
        r'\s*어디\s*있어\s*\??$',
        r'\s*어디\s*에?\s*있나\s*\??$',
        r'\s*어디\s*있지\s*\??$',
        r'\s*어디\s*에?\s*저장\s*되어?\s*있어\s*\??$',
        r'\s*확인\s*해?\s*줘?\s*\??$',
        r'\s*알려\s*줘?\s*\??$',
        r'\s*찾아\s*봐?\s*\??$',
        r'\s*위치\s*알려\s*줘?\s*\??$',
        r'\s*경로\s*알려\s*줘?\s*\??$',
        r'\s*어디\s*에?\s*$',
        r'\s*어디\s*$',
        
        # 특수 케이스
        r'\s*이\s*어디\s*있지\s*\??$',  # '파일이 어디있지?'
    ]
    
    # 원본 명령어 복사
    cleaned = command
    
    # 패턴 제거
    for pattern in remove_patterns:
        cleaned = re.sub(pattern, '', cleaned)
    
    # 추가 정리
    cleaned = cleaned.strip()
    
    # 빈 문자열이면 원본 반환
    if not cleaned:
        return command
    
    # 특수 케이스 처리
    cleaned = handle_special_cases(cleaned, command)
    
    return cleaned


def handle_special_cases(cleaned, original):
    """
    특수한 케이스들을 처리하는 함수
    
    Args:
        cleaned: 정리된 검색어
        original: 원본 명령어
        
    Returns:
        str: 최종 검색어
    """
    # '~가 어디있는지', '~이 어디있는지' 패턴 제거
    cleaned = re.sub(r'\s*가\s*어디\s*있는지\s*', '', cleaned)
    cleaned = re.sub(r'\s*이\s*어디\s*있는지\s*', '', cleaned)
    
    # '~에서 ~' 패턴 처리
    if '에서' in cleaned:
        # '계약서에서 조건 관련 내용' 형태로 유지
        parts = cleaned.split('에서', 1)
        if len(parts) == 2:
            doc = parts[0].strip()
            content = parts[1].strip()
            return f"{doc}에서 {content}"
    
    # '보고서에 매출 데이터가 있는지' → '보고서 매출 데이터'
    if '에' in cleaned and ('데이터가' in cleaned or '있는지' in cleaned):
        # '있는지' 제거
        cleaned = re.sub(r'\s*있는지\s*', '', cleaned)
        # '에' → 공백으로 변경
        cleaned = re.sub(r'에\s+', ' ', cleaned)
        # '데이터가' → '데이터'
        cleaned = cleaned.replace('데이터가', '데이터')
    
    # '~가 있는지' 패턴 제거
    cleaned = re.sub(r'\s*가\s*있는지\s*', '', cleaned)
    cleaned = re.sub(r'\s*이\s*있는지\s*', '', cleaned)
    
    # 불필요한 조사 제거 (순서 중요)
    # '~들' 처리 (파일들, 문서들)
    if '들' in cleaned and ('파일들' in cleaned or '문서들' in cleaned):
        # '파일들', '문서들'은 유지
        pass
    else:
        # 다른 경우의 '들' 제거
        cleaned = re.sub(r'(\w+)들\s+', r'\1 ', cleaned)
    
    # 기타 조사 정리
    cleaned = re.sub(r'\s+을\s+', ' ', cleaned)
    cleaned = re.sub(r'\s+를\s+', ' ', cleaned)
    cleaned = re.sub(r'\s+이\s+', ' ', cleaned)
    cleaned = re.sub(r'\s+가\s+', ' ', cleaned)
    
    # 문장 끝 조사 제거
    cleaned = re.sub(r'\s*을\s*$', '', cleaned)
    cleaned = re.sub(r'\s*를\s*$', '', cleaned)
    cleaned = re.sub(r'\s*이\s*$', '', cleaned)
    cleaned = re.sub(r'\s*가\s*$', '', cleaned)
    
    # 중복 공백 제거
    cleaned = ' '.join(cleaned.split())
    
    return cleaned

def generate_search_description(search_term):
    description = f"'{search_term}'에 대한 검색을 실행합니다."
    return description

def generate_summarize_description(context):
    """
    요약 작업에 대한 설명 문장을 생성하는 함수
    
    Args:
        context: 작업 컨텍스트 정보 (selectedFiles 포함)
        
    Returns:
        str: "파일명의 주요 내용을 요약합니다." 또는 "선택한 X개 문서의 주요 내용을 요약합니다." 형태의 설명 문장
    """
    # 1. selectedFiles에서 파일 이름들 추출
    if not context.selectedFiles or len(context.selectedFiles) == 0:
        return "선택된 문서가 없습니다."
    
    file_count = len(context.selectedFiles)
    
    # 2. 단일 파일인 경우
    if file_count == 1:
        file_name = context.selectedFiles[0].get('name', '문서')
        # 파일 확장자 제거하여 더 자연스러운 문장 생성
        clean_name = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
        result_desc = f"{clean_name}의 주요 내용을 요약합니다."
    
    # 3. 복수 파일인 경우
    else:
        # 파일 개수가 3개 이하인 경우 모든 파일명 나열
        if file_count <= 3:
            file_names = []
            for file in context.selectedFiles:
                file_name = file.get('name', '')
                # 파일 확장자 제거
                clean_name = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
                file_names.append(clean_name)
            
            names_str = ', '.join(file_names)
            result_desc = f"{names_str}의 주요 내용을 요약합니다."
        
        # 파일 개수가 많은 경우 개수로 표시
        else:
            result_desc = f"선택한 {file_count}개 문서의 주요 내용을 요약합니다."

    return result_desc
