import React, { useState } from 'react';
import './OperationPreviewModal.css';
import { OPERATION_TYPES, RISK_LEVELS } from './CommandProcessor';

const OperationPreviewModal = ({ 
  operationData, 
  onConfirm, 
  onCancel, 
  onClose,
  isVisible 
}) => {
  const [userOptions, setUserOptions] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  if (!isVisible || !operationData) return null;

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case RISK_LEVELS.LOW: return '#28a745';
      case RISK_LEVELS.MEDIUM: return '#ffc107';
      case RISK_LEVELS.HIGH: return '#fd7e14';
      case RISK_LEVELS.CRITICAL: return '#dc3545';
      default: return '#6c757d';
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(userOptions);
    } finally {
      setIsLoading(false);
    }
  };

  const renderOperationDetails = () => {
    const { operation, preview } = operationData;

    switch (operation?.type) {
      case OPERATION_TYPES.DELETE:
        return (
          <div className="operation-details">
            <h3>🗑️ 파일 삭제</h3>
            <div className="target-files">
              <h4>삭제될 파일:</h4>
              {operation.targets?.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-path">{file.path}</span>
                </div>
              ))}
            </div>
            <div className="warnings">
              {preview?.warnings?.map((warning, index) => (
                <div key={index} className="warning-item">
                  ⚠️ {warning}
                </div>
              ))}
            </div>
          </div>
        );

      case OPERATION_TYPES.MOVE:
        return (
          <div className="operation-details">
            <h3>📁 파일 이동</h3>
            <div className="move-preview">
              <div className="source-section">
                <h4>이동할 파일:</h4>
                {operation.targets?.map((file, index) => (
                  <div key={index} className="file-item">{file.name}</div>
                ))}
              </div>
              <div className="arrow">→</div>
              <div className="destination-section">
                <h4>대상 위치:</h4>
                <div className="destination-path">{operation.destination}</div>
              </div>
            </div>
          </div>
        );

      case OPERATION_TYPES.COPY:
        return (
          <div className="operation-details">
            <h3>📋 파일 복사</h3>
            <div className="copy-preview">
              <div className="source-section">
                <h4>복사할 파일:</h4>
                {operation.targets?.map((file, index) => (
                  <div key={index} className="file-item">{file.name}</div>
                ))}
              </div>
              <div className="arrow">⟹</div>
              <div className="destination-section">
                <h4>복사 위치:</h4>
                <div className="destination-path">{operation.destination}</div>
              </div>
            </div>
            <div className="copy-options">
              <label>
                <input
                  type="checkbox"
                  checked={userOptions.replaceIfExists || false}
                  onChange={(e) => setUserOptions(prev => ({
                    ...prev,
                    replaceIfExists: e.target.checked
                  }))}
                />
                같은 이름의 파일이 있으면 덮어쓰기
              </label>
            </div>
          </div>
        );

      case OPERATION_TYPES.CREATE_FOLDER:
        return (
          <div className="operation-details">
            <h3>📁 폴더 생성</h3>
            <div className="folder-creation">
              <h4>생성될 폴더:</h4>
              <div className="new-folder">
                <div className="folder-icon">📁</div>
                <div className="folder-info">
                  <div className="folder-name">{operation.folderName}</div>
                  <div className="folder-path">{operation.parentPath}/{operation.folderName}</div>
                </div>
              </div>
            </div>
          </div>
        );

      case OPERATION_TYPES.RENAME:
        return (
          <div className="operation-details">
            <h3>✏️ 파일 이름 변경</h3>
            <div className="rename-preview">
              <div className="source-section">
                <h4>현재 이름:</h4>
                <div className="file-item">{operation.target?.name}</div>
              </div>
              <div className="arrow">→</div>
              <div className="destination-section">
                <h4>새 이름:</h4>
                <div className="destination-path">{operation.newName}</div>
              </div>
            </div>
          </div>
        );

      case OPERATION_TYPES.SEARCH:
        return (
          <div className="operation-details">
            <h3>🔍 파일 검색</h3>
            <div className="search-info">
              <h4>검색어:</h4>
              <div className="search-term">{operation.searchTerm}</div>
            </div>
          </div>
        );

      case OPERATION_TYPES.SUMMARIZE:
        return (
          <div className="operation-details">
            <h3>📄 문서 요약</h3>
            <div className="target-files">
              <h4>요약할 문서:</h4>
              {operation.targets?.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="operation-details">
            <h3>{preview?.title || '작업 미리보기'}</h3>
            <div className="description">{preview?.description || operationData.previewAction}</div>
          </div>
        );
    }
  };

  return (
    <div className="operation-modal-overlay">
      <div className="operation-modal">
        <div className="modal-header">
          <h2>작업 확인</h2>
          <div 
            className="risk-indicator" 
            style={{ backgroundColor: getRiskColor(operationData.riskLevel) }}
          >
            위험도: {operationData.riskLevel?.toUpperCase()}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {renderOperationDetails()}

          <div className="operation-summary">
            <h4>작업 요약:</h4>
            <p>{operationData.preview?.description || operationData.previewAction}</p>
            
            {operationData.preview?.estimatedTime && (
              <div className="estimated-time">
                예상 소요 시간: {operationData.preview.estimatedTime}
              </div>
            )}

            {operationData.preview?.consequences && (
              <div className="consequences">
                <h5>결과:</h5>
                <ul>
                  {operationData.preview.consequences.map((consequence, index) => (
                    <li key={index}>{consequence}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="cancel-btn" 
            onClick={onCancel}
            disabled={isLoading}
          >
            취소
          </button>
          <button 
            className="confirm-btn" 
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? '처리 중...' : '확인 및 실행'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperationPreviewModal;