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

    # 테스트테스트테스트테스트
    # 테스트 명령어들
    test_commands = [
        # DELETE (3개)
        "파일을 삭제해줘",
        "이 문서들 지워줘", 
        "필요없는 파일 제거해줘",
        
        # RENAME (3개)
        "파일 이름변경해줘",
        "이름 바꿔줘",
        "파일명 수정하고 싶어",
        
        # CREATE_FOLDER (3개)
        "새 폴더 만들어줘",
        "폴더 생성해줘",
        "디렉토리 만들고 싶어",
        
        # MOVE (3개)
        "파일을 마케팅 폴더로 이동해줘",
        "문서를 다른 곳으로 옮겨줘",
        "이 파일들 위치변경해줘",
        
        # COPY (3개)
        "파일을 복사해줘",
        "문서를 백업해줘",
        "이 파일들 복제해줘",
        
        # SUMMARIZE (3개)
        "문서 내용을 요약해줘",
        "이 파일들 정리해줘",
        "내용 정리하고 싶어",
        
        # SEARCH (3개)
        "파일을 검색해줘",
        "문서 찾아줘",
        "이 문서 어디있나 찾아줘",
        
        # ERROR ERR-1 부정표현 (3개)
        "파일을 이동하지마",
        "삭제하지 말아줘",
        "복사 안해줘",
        
        # ERROR ERR-1 파일관련이지만 매칭안됨 (3개)
        "파일을 좀비로 바꿔줘",
        "문서를 폭파해줘",
        "파일을 우주로 보내줘",
        
        # ERROR ERR-2 파일과 관련없는 명령 (3개)
        "안녕하세요",
        "오늘 날씨가 어때요?",
        "점심 뭐 먹을까요?"
    ]

    for cmd in test_commands:
        result = invoke.get_operation_type(cmd)
        print(f"'{cmd}' → {result}")
    debugging.stop_debugger()
    # 테스트테스트테스트테스트




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
    destination, description = await invoke.analyze_move_command(command, context)


    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
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
    destination, description = await invoke.analyze_copy_command(command, context)

    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
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
        "riskLevel": "low",  # 복사는 원본 파일을 보존하므로 위험도가 낮음
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
    pass

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
    pass

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