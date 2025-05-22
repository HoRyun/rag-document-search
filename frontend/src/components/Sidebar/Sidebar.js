import React, { useState, useEffect } from 'react';
import './Sidebar.css';

const Sidebar = ({ className, directories, currentPath, setCurrentPath, onRefresh, closeSidebar }) => {
  // 폴더 접기/펼치기 상태 관리 (기본값: 루트만 펼침)
  const [expandedFolders, setExpandedFolders] = useState({ '/': true });
  // 이전 열린 상태 기억용 저장소
  const [prevExpandedState, setPrevExpandedState] = useState({});
  
  // 처음 마운트 시, 현재 경로에 따라 적절한 폴더들을 열어둠
  useEffect(() => {
    if (currentPath !== '/') {
      const pathParts = currentPath.split('/').filter(Boolean);
      const newExpanded = { ...expandedFolders };
      
      let currentBuildPath = '';
      pathParts.forEach(part => {
        currentBuildPath += '/' + part;
        newExpanded[currentBuildPath] = true;
      });
      
      setExpandedFolders(newExpanded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 현재 경로가 변경될 때마다 해당 경로의 상위 폴더들을 자동으로 펼침
  useEffect(() => {
    if (currentPath !== '/') {
      const pathParts = currentPath.split('/').filter(Boolean);
      const newExpanded = { ...expandedFolders };
      
      let currentBuildPath = '';
      pathParts.forEach(part => {
        currentBuildPath += '/' + part;
        newExpanded[currentBuildPath] = true;
      });
      
      setExpandedFolders(newExpanded);
    }
  }, [currentPath, expandedFolders]);

  const handleDirectoryClick = (path) => {
    setCurrentPath(path);
    // 모바일 환경에서 디렉토리 클릭시 사이드바 닫기
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  // 폴더 토글 핸들러 (접기/펼치기)
  const handleToggleFolder = (e, path) => {
    e.stopPropagation(); // 부모 요소로 이벤트 전파 방지
    
    // 현재 상태 가져오기
    const isCurrentlyExpanded = expandedFolders[path];
    
    // 새 상태 객체 생성
    const newExpandedState = { ...expandedFolders };
    
    if (isCurrentlyExpanded) {
      // 폴더를 접을 때, 모든 하위 폴더의 상태를 저장
      const subFolderStates = {};
      Object.keys(newExpandedState).forEach(folderPath => {
        if (folderPath !== path && folderPath.startsWith(path)) {
          subFolderStates[folderPath] = newExpandedState[folderPath];
        }
      });
      // 이전 상태 저장
      setPrevExpandedState(prev => ({
        ...prev,
        [path]: subFolderStates
      }));
    } else {
      // 폴더를 펼칠 때, 이전에 저장된 하위 폴더 상태 복원
      if (prevExpandedState[path]) {
        Object.entries(prevExpandedState[path]).forEach(([subPath, wasExpanded]) => {
          newExpandedState[subPath] = wasExpanded;
        });
      }
    }
    
    // 현재 폴더의 상태 토글
    newExpandedState[path] = !isCurrentlyExpanded;
    
    setExpandedFolders(newExpandedState);
  };

  // 디렉토리 계층 구조로 구성
  const organizeDirectories = () => {
    // 디렉토리를 깊이별로 정렬
    const sortedDirs = [...directories].sort((a, b) => {
      // 루트 디렉토리는 항상 첫 번째
      if (a.path === '/') return -1;
      if (b.path === '/') return 1;
      
      // 경로 깊이 계산
      const depthA = a.path.split('/').filter(Boolean).length;
      const depthB = b.path.split('/').filter(Boolean).length;
      
      // 깊이가 다르면 깊이 순으로 정렬
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      
      // 같은 깊이면 이름 순으로 정렬
      return a.name.localeCompare(b.name, 'ko');
    });
    
    // 계층 구조 생성
    const dirMap = {};
    
    // 모든 디렉토리 맵 생성
    sortedDirs.forEach(dir => {
      dirMap[dir.path] = {
        ...dir,
        children: []
      };
    });
    
    // 루트 디렉토리 확인
    let rootDir = dirMap['/'];
    if (!rootDir) {
      rootDir = {
        id: 'root',
        name: 'Home',
        path: '/',
        children: []
      };
      dirMap['/'] = rootDir;
    }
    
    // 계층 구조 구성
    sortedDirs.forEach(dir => {
      if (dir.path === '/') return; // 루트는 건너뜀
      
      const parts = dir.path.split('/').filter(Boolean);
      const parentPath = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');
      
      if (dirMap[parentPath]) {
        dirMap[parentPath].children.push(dirMap[dir.path]);
      } else {
        // 부모 폴더가 없는 경우 가상의 부모 폴더 생성
        const parentDir = {
          id: `virtual-${parentPath}`,
          name: parts[parts.length - 2] || 'Unknown',
          path: parentPath,
          children: [dirMap[dir.path]]
        };
        dirMap[parentPath] = parentDir;
        
        // 다시 상위 계층에 추가 시도
        const grandParentParts = parts.slice(0, -1);
        const grandParentPath = grandParentParts.length === 0 ? '/' : '/' + grandParentParts.slice(0, -1).join('/');
        
        if (dirMap[grandParentPath]) {
          dirMap[grandParentPath].children.push(dirMap[parentPath]);
        }
      }
    });
    
    return dirMap['/'];
  };
  
  // 재귀적으로 디렉토리 트리 렌더링
  const renderDirectoryTree = (dir, level = 0) => {
    const isExpanded = expandedFolders[dir.path];
    const hasChildren = dir.children && dir.children.length > 0;
    
    return (
      <React.Fragment key={dir.id}>
        <div 
          className={`directory-item ${currentPath === dir.path ? 'active' : ''}`}
          onClick={() => handleDirectoryClick(dir.path)}
          style={{ paddingLeft: `${15 + level * 20}px` }}
        >
          <div className="directory-toggle">
            {hasChildren && (
              <span 
                className={`toggle-icon ${isExpanded ? 'expanded' : 'collapsed'}`}
                onClick={(e) => handleToggleFolder(e, dir.path)}
              >
                {isExpanded ? '▼' : '►'}
              </span>
            )}
          </div>
          <div className="directory-icon">
            <i className="folder-icon"></i>
          </div>
          <div className="directory-name">{dir.name}</div>
        </div>
        
        {/* 하위 폴더 렌더링 */}
        {hasChildren && isExpanded && (
          <div className="subdirectory-container">
            {dir.children.sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(child => 
              renderDirectoryTree(child, level + 1)
            )}
          </div>
        )}
      </React.Fragment>
    );
  };

  // 디렉토리 계층 구조 구성
  const rootDirectory = organizeDirectories();

  return (
    <div className={`sidebar ${className || ''}`}>
      <div className="sidebar-header">
        <h3>디렉토리</h3>
        <div className="sidebar-actions">
          <button className="refresh-sidebar-btn" onClick={handleRefresh}>
            새로고침
          </button>
          <button className="close-sidebar-btn" onClick={closeSidebar}>
            ✕
          </button>
        </div>
      </div>
      <div className="directory-list">
        {renderDirectoryTree(rootDirectory)}
      </div>
    </div>
  );
};

export default Sidebar;