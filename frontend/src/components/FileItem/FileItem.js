import React from 'react';
import './FileItem.css';

const FileItem = ({ file, onClick, onDoubleClick }) => {
  // Get icon based on file type
  const getFileIcon = () => {
    // 폴더인 경우 폴더 아이콘 반환
    if (file.isDirectory || file.type === 'folder') {
      return 'folder-icon';
    }

    switch (file.type) {
      case 'document':
      case 'pdf':
        return 'document-icon';
      case 'spreadsheet':
      case 'xlsx':
      case 'xls':
      case 'csv':
        return 'spreadsheet-icon';
      case 'presentation':
      case 'ppt':
      case 'pptx':
        return 'presentation-icon';
      case 'image':
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return 'image-icon';
      case 'blank':
      case 'txt':
        return 'blank-icon';
      default:
        return 'file-icon';
    }
  };

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  const handleDoubleClick = (e) => {
    if (onDoubleClick) {
      onDoubleClick(e);
    }
  };

  return (
    <div 
      className={`file-item ${file.isDirectory || file.type === 'folder' ? 'directory-item' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className={`file-icon ${getFileIcon()}`}></div>
      <div className="file-name">{file.name}</div>
    </div>
  );
};

export default FileItem;