import React from 'react';
import './Sidebar.css';

const Sidebar = ({ directories, currentPath, setCurrentPath, onRefresh }) => {
  const handleDirectoryClick = (path) => {
    setCurrentPath(path);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  // 파일 경로의 깊이에 따라 들여쓰기 추가
  const getIndentLevel = (path) => {
    if (path === '/') return 0;
    return path.split('/').filter(Boolean).length;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>디렉토리</h3>
        <button className="refresh-sidebar-btn" onClick={handleRefresh}>
          새로고침
        </button>
      </div>
      <div className="directory-list">
        {directories.map((dir) => (
          <div 
            key={dir.id} 
            className={`directory-item ${currentPath === dir.path ? 'active' : ''}`}
            onClick={() => handleDirectoryClick(dir.path)}
            style={{ paddingLeft: `${15 + getIndentLevel(dir.path) * 10}px` }}
          >
            <div className="directory-icon">
              <i className="folder-icon"></i>
            </div>
            <div className="directory-name">{dir.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;