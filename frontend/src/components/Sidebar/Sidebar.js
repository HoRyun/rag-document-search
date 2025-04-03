import React from 'react';
import './Sidebar.css';

const Sidebar = ({ currentPath, setCurrentPath }) => {
  // Sample directory structure
  const directories = [
    { id: 1, name: 'Home', path: '/' },
    { id: 2, name: 'Documents', path: '/documents' },
    { id: 3, name: 'Pictures', path: '/pictures' },
    { id: 4, name: 'Videos', path: '/videos' },
    { id: 5, name: 'Downloads', path: '/downloads' },
  ];

  const handleDirectoryClick = (path) => {
    setCurrentPath(path);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Directories</h3>
      </div>
      <div className="directory-list">
        {directories.map((dir) => (
          <div 
            key={dir.id} 
            className={`directory-item ${currentPath === dir.path ? 'active' : ''}`}
            onClick={() => handleDirectoryClick(dir.path)}
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