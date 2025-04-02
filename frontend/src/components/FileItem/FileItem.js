import React from 'react';
import './FileItem.css';

const FileItem = ({ file }) => {
  // Get icon based on file type
  const getFileIcon = () => {
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

  return (
    <div className="file-item">
      <div className={`file-icon ${getFileIcon()}`}></div>
      <div className="file-name">{file.name}</div>
    </div>
  );
};

export default FileItem;