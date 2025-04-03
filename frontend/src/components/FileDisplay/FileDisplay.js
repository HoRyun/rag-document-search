import React, { useState, useRef } from 'react';
import FileItem from '../FileItem/FileItem';
import './FileDisplay.css';

const FileDisplay = ({ files, currentPath, onAddFile, onRefresh }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
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
        fileInputRef.current.value = '';
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

  return (
    <div 
      className={`file-display ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="file-display-header">
        <h2>{currentPath === '/' ? 'Home' : currentPath.substring(1)}</h2>
        <div className="file-actions">
          <button className="refresh-btn" onClick={handleRefresh}>
            Refresh
          </button>
          <button 
            className="upload-btn" 
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Upload File"}
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          multiple
          accept=".pdf,.docx,.doc,.hwp,.hwpx,.xlsx,.xls,.txt"
        />
      </div>
      
      <div className="file-grid">
        {files.length > 0 ? (
          files.map(file => (
            <FileItem key={file.id} file={file} />
          ))
        ) : (
          <div className="empty-message">
            <p>This folder is empty</p>
            <p className="drop-message">Drag and drop files here or use the Upload button</p>
          </div>
        )}
      </div>
      
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-message">
            <p>Drop files here to upload</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDisplay;