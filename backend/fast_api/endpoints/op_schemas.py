from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

# Pydantic 모델들
class OperationContext(BaseModel):
    currentPath: str
    selectedFiles: list = []
    availableFolders: list = []
    timestamp: datetime

class StageOperationRequest(BaseModel):
    command: str
    context: OperationContext


class StageOperationResponse(BaseModel):
    operationId: str
    operation: Dict[str, Any]
    requiresConfirmation: bool
    riskLevel: str
    preview: Dict[str, Any]

class ExecuteOperationRequest(BaseModel):
    confirmed: bool = True
    userOptions: Dict[str, Any] = {}
    executionTime: datetime

class UndoOperationRequest(BaseModel):
    reason: str = ""
    undoTime: datetime


class ExecutionResponse(BaseModel):
    message: str
    undoAvailable: bool = False
    undoDeadline: Optional[datetime] = None

class BasicResponse(BaseModel):
    message: str