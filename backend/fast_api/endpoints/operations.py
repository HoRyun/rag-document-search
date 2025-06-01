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

    # 타입을 결정. (모델 호출.)
    operation_type = await invoke.get_operation_type(command)

    # 타입 별 AI 호출 분기. 각 함수의 매개변수로 command, context전달.
    if operation_type == "move":
        result = await process_move(command, context)
    elif operation_type == "copy":
        result = process_copy(command, context)
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


    # TODO: 실제 로직 구현
    pass

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
    # destination, description = await invoke.analyze_move_command(command, context)
    test = await invoke.analyze_move_command(command, context)


    # 데이터 준비
    operationId = "op-"+str(uuid.uuid4())
    destination = None
    description = None
    warnings = [] 
    
    # 리턴 객체 준비
    result = {
  "operation": {
    "type": "move",
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

    pass

def process_copy(command, context):
    """
    복사 작업을 처리하는 함수
    
    Args:
        command: 사용자의 자연어 명령
        context: 작업 컨텍스트 정보
        
    Returns:
        작업 결과 정보
    """
    pass

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