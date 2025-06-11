import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import './FileItem.css';

const FileItem = ({ 
  file, 
  onClick, 
  onDoubleClick, 
  onDelete, 
  onRename, 
  onMove, 
  onCopy, 
  isSelected,
  isMobile = false // 모바일 환경 여부 프롭스 추가
}) => {
  const { t } = useTranslation();
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
  
  // 모바일 꾹 누르기(long press) 감지
  const pressTimer = useRef(null);
  const [isPressing, setIsPressing] = useState(false);

  const handleTouchStart = (e) => {
    // 모바일에서만 처리
    if (!isMobile) return;
    
    setIsPressing(true);
    pressTimer.current = setTimeout(() => {
      // 꾹 누르기 감지 - 컨텍스트 메뉴 표시
      const touch = e.touches[0];
      setContextMenuPos({ 
        x: touch.clientX, 
        y: touch.clientY 
      });
      setShowContextMenu(true);
      setIsPressing(false);
      
      // 브라우저 기본 컨텍스트 메뉴 방지
      e.preventDefault();
    }, 500); // 500ms 동안 꾹 누르면 컨텍스트 메뉴 표시
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    
    clearTimeout(pressTimer.current);
    setIsPressing(false);
  };

  const handleTouchMove = () => {
    if (!isMobile) return;
    
    clearTimeout(pressTimer.current);
    setIsPressing(false);
  };
  
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

  // 데스크톱에서는 더블클릭, 모바일에서는 일반 클릭으로 처리
  const handleDoubleClick = (e) => {
    if (!isRenaming && onDoubleClick) {
      // 모바일 환경에서는 일반 클릭으로 폴더를 열도록 하지 않음
      // FileDisplay에서 onClick 이벤트에서 처리
      if (!isMobile) {
        onDoubleClick(e);
      }
    }
  };
  
  // 모바일 환경에서는 일반 클릭으로 폴더를 열도록 처리
  const handleItemTap = (e) => {
    if (isMobile && (file.isDirectory || file.type === 'folder')) {
      if (!isRenaming && onDoubleClick) {
        onDoubleClick(e);
      }
    }
  };
  
  // 컨텍스트 메뉴 표시
  const handleContextMenu = (e) => {
    // 모바일에서는 컨텍스트 메뉴 처리 방식이 다름 (꾹 누르기로 대체)
    if (isMobile) return;
    
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
      if (window.confirm(t('confirmations.deleteFile', { name: file.name }))) {
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
  
  // 복사 처리
  const handleCopy = () => {
    if (onCopy) {
      onCopy(file);
    }
    setShowContextMenu(false);
  };

  const getItemStyle = () => {
    let style = {};
    
    // 꾹 누르기 시각적 피드백
    if (isPressing && isMobile) {
      style.opacity = 0.7;
      style.transform = 'scale(0.95)';
    }
    
    return style;
  };

  // 모바일에서는 컨텍스트 메뉴 스타일 조정
  const getContextMenuStyle = () => {
    if (isMobile) {
      // 모바일에서는 화면 하단에 고정 표시하는 바텀시트 형태
      return {
        position: 'fixed',
        left: '0',
        bottom: '0',
        width: '100%',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -2px 10px var(--shadow-color)'
      };
    } else {
      // 데스크톱에서는 마우스 위치에 표시
      return {
        position: 'fixed',
        left: `${contextMenuPos.x}px`,
        top: `${contextMenuPos.y}px`
      };
    }
  };

  return (
    <div 
      ref={itemRef}
      className={`file-item ${file.isDirectory || file.type === 'folder' ? 'directory-item' : ''} ${isSelected ? 'selected' : ''} ${isMobile ? 'mobile-item' : ''}`}
      onClick={(e) => {
        handleClick(e);
        if (isMobile) handleItemTap(e);
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      data-file-id={file.id}
      aria-selected={isSelected ? 'true' : 'false'}
      style={getItemStyle()}
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
          className={`context-menu ${isMobile ? 'mobile-context-menu' : ''}`} 
          style={getContextMenuStyle()}
        >
          {isMobile && (
            <div className="context-menu-header">
              <div className="context-menu-title">{file.name}</div>
              <button 
                className="close-context-menu" 
                onClick={() => setShowContextMenu(false)}
              >
                ✕
              </button>
            </div>
          )}
          
          <div className="context-menu-item" onClick={handleRenameStart}>
            {t('fileDisplay.contextMenu.rename')}
          </div>
          <div className="context-menu-item" onClick={handleCopyPath}>
            {t('fileDisplay.contextMenu.copyPath')}
          </div>
          <div className="context-menu-item" onClick={handleCopy}>
            {t('fileDisplay.contextMenu.copy')}
          </div>
          <div className="context-menu-item" onClick={handleMove}>
            {t('fileDisplay.contextMenu.move')}
          </div>
          <div className="context-menu-item delete-item" onClick={handleDelete}>
            {t('fileDisplay.contextMenu.delete')}
          </div>
          
          {isMobile && (
            <div 
              className="context-menu-item cancel-item" 
              onClick={() => setShowContextMenu(false)}
            >
              {t('fileDisplay.contextMenu.cancel')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileItem;