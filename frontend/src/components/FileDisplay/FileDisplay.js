import React, { useState, useRef } from 'react';
import FileItem from '../FileItem/FileItem';
import './FileDisplay.css';

const FileDisplay = ({ files, currentPath, onAddFile }) => {
  const [isDragging, setIsDragging] = useState(false);
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
  const handleFiles = (fileList) => {
    for (let i = 0; i < fileList.length; i++) {
      onAddFile(fileList[i]);
    }
  };
  
  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current.click();
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
        <button className="upload-btn" onClick={handleUploadClick}>
          Upload File
        </button>
        <input 
          type="file" 
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          multiple
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