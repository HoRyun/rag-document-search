from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

# 기본 파일/폴더 모델
class FileItem(BaseModel):
    id: str
    name: str
    type: str
    path: str
    size: Optional[int] = None

class FolderItem(BaseModel):
    id: str
    name: str
    path: str

# Pydantic 모델들
class OperationContext(BaseModel):
    currentPath: str
    selectedFiles: List[FileItem] = []
    availableFolders: List[FolderItem] = []
    timestamp: datetime

class StageOperationRequest(BaseModel):
    command: str
    context: OperationContext

# 작업별 Operation 모델들
class MoveOperation(BaseModel):
    type: str = "move"
    targets: List[FileItem]
    destination: str

class CopyOperation(BaseModel):
    type: str = "copy"
    targets: List[FileItem]
    destination: str

class DeleteOperation(BaseModel):
    type: str = "delete"
    targets: List[FileItem]

class RenameOperation(BaseModel):
    type: str = "rename"
    target: Union[FileItem, List[FileItem]]
    newName: str

class CreateFolderOperation(BaseModel):
    type: str = "create_folder"
    folderName: str
    parentPath: str

class SearchOperation(BaseModel):
    type: str = "search"
    searchTerm: str

class SummarizeOperation(BaseModel):
    type: str = "summarize"
    targets: List[FileItem]

class ErrorOperation(BaseModel):
    type: str = "error"
    error_type: str
    message: str

# 미리보기 정보 모델
class OperationPreview(BaseModel):
    description: str
    warnings: List[str] = []

class StageOperationResponse(BaseModel):
    operationId: str
    operation: Union[MoveOperation, CopyOperation, DeleteOperation, RenameOperation, 
                   CreateFolderOperation, SearchOperation, SummarizeOperation, ErrorOperation]
    requiresConfirmation: bool
    riskLevel: str
    preview: OperationPreview

class ExecuteOperationRequest(BaseModel):
    confirmed: bool = True
    userOptions: Dict[str, Any] = {}
    executionTime: datetime

class UndoOperationRequest(BaseModel):
    reason: str = ""
    undoTime: datetime

# 실행 결과 모델들
class OperationResult(BaseModel):
    status: str
    message: str
    item_id: Optional[str] = None

class SearchDocument(BaseModel):
    name: str
    path: str

class SearchResultData(BaseModel):
    answer: str
    documents: List[SearchDocument]
    documentCount: int

class SummaryData(BaseModel):
    name: str
    summary: str

class ExecutionResponse(BaseModel):
    message: str
    undoAvailable: bool = False
    undoDeadline: Optional[datetime] = None
    results: Optional[List[OperationResult]] = None
    searchResults: Optional[SearchResultData] = None
    summaries: Optional[List[SummaryData]] = None

# Undo 결과 모델
class UndoResult(BaseModel):
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None

class BasicResponse(BaseModel):
    message: str

# Redis 저장용 모델
class OperationStoreData(BaseModel):
    operation_id: str
    command: str
    context: Dict[str, Any]
    operation: Dict[str, Any]
    requiresConfirmation: bool
    riskLevel: str
    preview: Dict[str, Any]
    user_id: int
    created_at: str