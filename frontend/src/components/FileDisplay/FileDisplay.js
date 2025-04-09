import React, { useState, useRef } from "react";
import FileItem from "../FileItem/FileItem";
import "./FileDisplay.css";

const FileDisplay = ({ files, currentPath, onAddFile, onCreateFolder, onFolderOpen, onRefresh, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef(null);
  const newFolderInputRef = useRef(null);

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Handle file input change (from button click)
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  // Process the files
  const handleFiles = async (fileList) => {
    setIsUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        await onAddFile(fileList[i]);
      }
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error handling files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  // Refresh file list
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  // Show new folder input
  const handleNewFolderClick = () => {
    setShowNewFolderInput(true);
    setTimeout(() => {
      if (newFolderInputRef.current) {
        newFolderInputRef.current.focus();
      }
    }, 0);
  };

  // Create new folder
  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (newFolderName.trim() && onCreateFolder) {
      onCreateFolder(newFolderName);
      setNewFolderName("");
      setShowNewFolderInput(false);
    }
  };

  // Cancel new folder creation
  const handleCancelNewFolder = () => {
    setNewFolderName("");
    setShowNewFolderInput(false);
  };

  // Handle file or folder click
  const handleItemClick = (file) => {
    if (file.isDirectory || file.type === 'folder') {
      // 현재 경로에 폴더명을 추가
      const newPath = currentPath === "/" 
        ? `/${file.name}` 
        : `${currentPath}/${file.name}`;
      
      onFolderOpen(newPath);
    }
  };

  // 현재 경로를 쉽게 탐색할 수 있는 경로 표시줄 생성
  const renderBreadcrumbs = () => {
    if (currentPath === "/") {
      return <span className="breadcrumb-item active">홈</span>;
    }

    const paths = currentPath.split('/').filter(Boolean);
    return (
      <>
        <span 
          className="breadcrumb-item" 
          onClick={() => onFolderOpen("/")}
        >
          홈
        </span>
        {paths.map((folder, index) => {
          const path = '/' + paths.slice(0, index + 1).join('/');
          const isLast = index === paths.length - 1;
          return (
            <span key={path}>
              <span className="breadcrumb-separator">/</span>
              <span 
                className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                onClick={() => !isLast && onFolderOpen(path)}
              >
                {folder}
              </span>
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div
      className={`file-display ${isDragging ? "dragging" : ""} ${isLoading ? "loading" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="file-display-header">
        <div className="path-navigator">
          {renderBreadcrumbs()}
        </div>
        <div className="file-actions">
          <button 
            className="new-folder-btn" 
            onClick={handleNewFolderClick}
            disabled={showNewFolderInput || isLoading}
          >
            새 폴더
          </button>
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            새로고침
          </button>
          <button
            className="upload-btn"
            onClick={handleUploadClick}
            disabled={isUploading || isLoading}
          >
            {isUploading ? "업로드 중..." : "파일 업로드"}
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileInputChange}
          multiple
          accept=".pdf,.docx,.doc,.hwp,.hwpx,.xlsx,.xls,.txt,.jpg,.jpeg,.png,.gif"
        />
      </div>

      {showNewFolderInput && (
        <div className="new-folder-input-container">
          <form onSubmit={handleCreateFolder}>
            <input
              type="text"
              ref={newFolderInputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="새 폴더 이름"
              className="new-folder-input"
            />
            <div className="new-folder-actions">
              <button type="submit" className="create-btn">생성</button>
              <button 
                type="button" 
                className="cancel-btn"
                onClick={handleCancelNewFolder}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="file-grid">
        {isLoading ? (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>로딩 중...</p>
          </div>
        ) : files.length > 0 ? (
          files.map((file) => (
            <FileItem 
              key={file.id} 
              file={file} 
              onClick={() => handleItemClick(file)}
              onDoubleClick={() => handleItemClick(file)}
            />
          ))
        ) : (
          <div className="empty-message">
            <p>이 폴더에 파일이 없습니다</p>
            <p className="drop-message">
              여기에 파일을 끌어서 놓거나 업로드 버튼을 사용하세요
            </p>
          </div>
        )}
      </div>

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-message">
            <p>파일을 여기에 놓아 업로드</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDisplay;