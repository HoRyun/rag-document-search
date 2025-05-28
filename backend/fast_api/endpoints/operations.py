from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from db.database import get_db
from db.models import User
from fast_api.security import get_current_user

from llm import invoke


router = APIRouter()

# 로깅 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Pydantic 모델들
class OperationContext(BaseModel):
    currentPath: str
    selectedFiles: list = []
    availableFolders: list = []
    timestamp: datetime

class StageOperationRequest(BaseModel):
    command: str
    context: OperationContext

class ExecuteOperationRequest(BaseModel):
    confirmed: bool = True
    userOptions: Dict[str, Any] = {}
    executionTime: datetime

class UndoOperationRequest(BaseModel):
    reason: str = ""
    undoTime: datetime

class OperationResponse(BaseModel):
    operationId: str
    operation: Dict[str, Any]
    requiresConfirmation: bool
    riskLevel: str
    preview: Dict[str, Any]

class ExecutionResponse(BaseModel):
    message: str
    undoAvailable: bool = False
    undoDeadline: Optional[datetime] = None

class BasicResponse(BaseModel):
    message: str

@router.post("/stage", response_model=OperationResponse)
async def stage_operation(
    request: StageOperationRequest,
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
    operation_type = invoke.get_operation_type(command)
    # 타입 별 AI 호출 분기.

    # TODO: 실제 로직 구현
    pass

@router.post("/{operation_id}/execute", response_model=ExecutionResponse)
async def execute_operation(
    operation_id: str,
    request: ExecuteOperationRequest,
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

@router.post("/{operation_id}/cancel", response_model=BasicResponse)
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

@router.post("/{operation_id}/undo", response_model=BasicResponse)
async def undo_operation(
    operation_id: str,
    request: UndoOperationRequest,
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
