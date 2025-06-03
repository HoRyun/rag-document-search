from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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


@router.post("/stage", response_model=op_schemas.OperationResponse)
async def stage_operation(
    request: op_schemas.StageOperationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    자연어 명령을 분석하고 작업을 준비하는 엔드포인트
    
    Args:
        request: 사용자 명령과 컨텍스트 정보
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션
    
    Returns:
        OperationResponse: 준비된 작업 정보
    """
    logger.info(f"Stage operation request from user {current_user.id}: {request.command}")
    # debugging.stop_debugger()
    # command 값 접근
    command = request.command

    # context 값 접근
    context = request.context

    # context의 하위 아이템 접근
    current_path = context.currentPath
    selected_files = context.selectedFiles
    available_folders = context.availableFolders
    timestamp = context.timestamp

    # # 테스트테스트테스트테스트
    # # 테스트 명령어들
    # test_commands = [
    #     # destination 테스트
    #     # "프로젝트 폴더로 이동",
    #     # "새 폴더로 이동"
    #     # # DELETE (3개)
    #     # "파일을 삭제해줘",
    #     # "이 문서들 지워줘", 
    #     # "필요없는 파일 제거해줘",
        
    #     # # RENAME (3개)
    #     # "파일 이름변경해줘",
    #     # "이름 바꿔줘",
    #     # "파일명 수정하고 싶어",
        
    #     # # CREATE_FOLDER (3개)
    #     # "새 폴더 만들어줘",
    #     # "폴더 생성해줘",
    #     # "디렉토리 만들고 싶어",
        
    #     # # MOVE (3개)
    #     # "파일을 마케팅 폴더로 이동해줘",
    #     # "문서를 다른 곳으로 옮겨줘",
    #     # "이 파일들 위치변경해줘",
        
    #     # # COPY (3개)
    #     # "파일을 복사해줘",
    #     # "문서를 백업해줘",
    #     # "이 파일들 복제해줘",
        
    #     # # SUMMARIZE (3개)
    #     # "문서 내용을 요약해줘",
    #     # "이 파일들 정리해줘",
    #     # "내용 정리하고 싶어",
        
    #     # # SEARCH (3개)
    #     # "파일을 검색해줘",
    #     # "문서 찾아줘",
    #     # "이 문서 어디있나 찾아줘",
        
    #     # # ERROR ERR-1 부정표현 (3개)
    #     # "파일을 이동하지마",
    #     # "삭제하지 말아줘",
    #     # "복사 안해줘",
        
    #     # # ERROR ERR-1 파일관련이지만 매칭안됨 (3개)
    #     # "파일을 좀비로 바꿔줘",
    #     # "문서를 폭파해줘",
    #     # "파일을 우주로 보내줘",
        
    #     # # ERROR ERR-2 파일과 관련없는 명령 (3개)
    #     # "안녕하세요",
    #     # "오늘 날씨가 어때요?",
    #     # "점심 뭐 먹을까요?"
        
    #     # get_new_name()테스트
    #     "선택된 파일을 새문서로 바꿔줘",
    #     "이 폴더 이름을 마케팅으로 변경해줘",
    #     "파일명을 보고서2024로 수정해줘",
    #     "디렉토리를 프로젝트폴더로 이름변경해줘",
    #     "선택한 문서를 최종버전으로 리네임해줘",
    #     "이름을 임시파일로 바꿔",
    #     "파일을 백업데이터로 rename해줘",
    #     "폴더명을 업무자료으로 변경",
    #     "선택된 항목을 새이름123으로 수정하고 싶어",
    #     "이 파일 이름을 중요문서로 바꿔주세요"
    # ]

    # for cmd in test_commands:
    #     output = get_new_name(cmd)
    #     output_desc = generate_rename_description(context, output)
    #     print(f"'{cmd}' → {output}")
    #     print(f"'{cmd}' → {output_desc}")
    #     print("--------------------------------")
    # debugging.stop_debugger()
    # # 테스트테스트테스트테스트




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
        result = process_search(command, context)
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
    
    # 리턴 객체 준비
    result = {
  "operation": {
    "type": "move",
    "targets": context.selectedFiles, # 사용자가 선택한 파일
    "destination": destination # "/업무/마케팅"
  },
  "requiresConfirmation": True,
  "riskLevel": "medium",
  "operationId": operationId,
  "preview": {
    "description": description,
    "warnings": warnings
  }
}
    

    return result

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
    
    # 리턴 객체 준비
    result = {
  "operation": {
    "type": "copy",
    "targets": context.selectedFiles, # 사용자가 선택한 파일
    "destination": destination # "/업무/마케팅"
  },
  "requiresConfirmation": True,
  "riskLevel": "low",
  "operationId": operationId,
  "preview": {
    "description": description,
    "warnings": warnings
  }
}
    

    return result

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
    
    # 리턴 객체 준비
    result = {
  "operation": {
    "type": "delete",
    "targets": context.selectedFiles # 사용자가 선택한 파일
  },
  "requiresConfirmation": True,
  "riskLevel": "high",
  "operationId": operationId,
  "preview": {
    "description": description,
    "warnings": warnings
  }
}
    

    return result

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
    
    # 리턴 객체 준비
    result = {
        "operation": {
            "type": "error",
            "error_type": error_type,
            "message": message
        },
        "requiresConfirmation": False,  # 에러이므로 확인 불필요
        "riskLevel": "none",           # 위험도 없음
        "operationId": operation_id,
        "preview": {
            "description": description,
            "warnings": warnings
        }
    }

    return result

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

    # 리턴 객체 준비
    result = {
        "operation": {
            "type": "rename",
    "target": context.selectedFiles, # 사용자가 선택한 파일
    "newName": new_name
  },
  "requiresConfirmation": True,
  "riskLevel": "medium",
  "operationId": operationId,
  "preview": {
    "description": description
  }
}
    
    return result


def process_create_folder(command, context):
    """
    폴더 생성 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """
    pass

def process_search(command, context):
    """
    검색 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """
    pass

def process_summarize(command, context):
    """
    요약 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """
    pass

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