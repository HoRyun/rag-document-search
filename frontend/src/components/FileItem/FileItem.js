import React, { useState, useRef, useEffect } from 'react';
import './FileItem.css';

const FileItem = ({ file, onClick, onDoubleClick, onDelete, onRename, onMove, onCopy, isSelected }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  
  const renameInputRef = useRef(null);
  const itemRef = useRef(null);
  
  // 초기 이름 설정
  useEffect(() => {
    setNewName(file.name);
  }, [file.name]);
  
  // 이름 변경 모드에서 자동 포커스
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);
  
  // 문서 레벨 클릭 이벤트 리스너 (컨텍스트 메뉴 닫기)
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (showContextMenu && itemRef.current && !itemRef.current.contains(e.target)) {
        setShowContextMenu(false);
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showContextMenu]);
  
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
    if (!isRenaming && onClick) {
      onClick(e);
    }
  };

  const handleDoubleClick = (e) => {
    if (!isRenaming && onDoubleClick) {
      onDoubleClick(e);
    }
  };
  
  // 컨텍스트 메뉴 표시
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };
  
  // 이름 변경 모드 시작
  const handleRenameStart = () => {
    setIsRenaming(true);
    setShowContextMenu(false);
  };
  
  // 이름 변경 완료
  const handleRenameComplete = () => {
    if (newName.trim() && newName !== file.name && onRename) {
      onRename(newName);
    }
    setIsRenaming(false);
  };
  
  // 이름 변경 취소
  const handleRenameCancel = () => {
    setNewName(file.name);
    setIsRenaming(false);
  };
  
  // 이름 변경 입력 키 처리
  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameComplete();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };
  
  // 삭제 처리
  const handleDelete = () => {
    if (onDelete) {
      if (window.confirm(`"${file.name}"을(를) 삭제하시겠습니까?`)) {
        onDelete();
      }
    }
    setShowContextMenu(false);
  };

  // 컨텍스트 메뉴 항목 클릭 핸들러
  const handleCopyPath = () => {
    // 파일 경로 복사 (예: 현재 경로 + 파일명)
    const path = file.path || file.name;
    navigator.clipboard.writeText(path)
      .then(() => {
        console.log('경로가 클립보드에 복사되었습니다:', path);
      })
      .catch(err => {
        console.error('경로 복사 중 오류 발생:', err);
      });
    setShowContextMenu(false);
  };
  
  // 이동 처리
  const handleMove = () => {
    if (onMove) {
      onMove(file);
    }
    setShowContextMenu(false);
  };

  return (
    <div 
      ref={itemRef}
      className={`file-item ${file.isDirectory || file.type === 'folder' ? 'directory-item' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      data-file-id={file.id}
      aria-selected={isSelected ? 'true' : 'false'}
    >
      <div className={`file-icon ${getFileIcon()}`}></div>
      
      {isRenaming ? (
        <div className="file-name-edit">
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRenameComplete}
            onKeyDown={handleRenameKeyDown}
            className="rename-input"
          />
        </div>
      ) : (
        <div className="file-name">{file.name}</div>
      )}
      
      {/* 컨텍스트 메뉴 */}
      {showContextMenu && (
        <div 
          className="context-menu" 
          style={{ 
            position: 'fixed',
            left: `${contextMenuPos.x}px`,
            top: `${contextMenuPos.y}px`
          }}
        >
          <div className="context-menu-item" onClick={handleRenameStart}>
            이름 변경
          </div>
          <div className="context-menu-item" onClick={handleCopyPath}>
            경로 복사
          </div>
          <div className="context-menu-item" onClick={() => onCopy && onCopy(file)}>
            복사
          </div>
          <div className="context-menu-item" onClick={handleMove}>
            이동
          </div>
          <div className="context-menu-item delete-item" onClick={handleDelete}>
            삭제
          </div>
        </div>
      )}
    </div>
  );
};

export default FileItem;