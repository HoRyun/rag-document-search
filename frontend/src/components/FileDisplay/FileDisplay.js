import React, { useState, useRef, useEffect, useCallback } from "react";
import FileItem from "../FileItem/FileItem";
import "./FileDisplay.css";

const FileDisplay = ({ 
  files, 
  directories, 
  currentPath, 
  onAddFile, 
  onCreateFolder, 
  onMoveItem, 
  onCopyItem, 
  onDeleteItem, 
  onRenameItem, 
  onFolderOpen, 
  onRefresh, 
  isLoading,
  selectedItems: parentSelectedItems = [],
  onSelectedItemsChange,
  onDownloadItems,
  isDownloading
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showUploadTypeMenu, setShowUploadTypeMenu] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 파일 선택 및 클립보드 관련 상태 추가
  const [selectedItems, setSelectedItems] = useState(parentSelectedItems);

  const [clipboard, setClipboard] = useState({ items: [], operation: null }); // operation: 'copy' 또는 'cut'
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [lastSelectedItem, setLastSelectedItem] = useState(null);

  // 드래그 선택(rubber band selection) 관련 상태 추가
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [selectionRect, setSelectionRect] = useState({ startX: 0, startY: 0, endX: 0, endY: 0 });
  // 드래그 직후 상태 추적용 상태 변수 추가
  const [justFinishedDragging, setJustFinishedDragging] = useState(false);

  // 이름 변경 모달 상태
  const [itemToRename, setItemToRename] = useState(null);
  const [newName, setNewName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);

  // 이동 모달 상태
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetPath, setTargetPath] = useState('');
  const [itemsToMove, setItemsToMove] = useState([]);

  // 컨텍스트 메뉴 및 알림 상태
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null });
  const [notification, setNotification] = useState({ visible: false, message: '' });

  // 기존 상태들과 함께 다운로드 관련 상태 추가
  const [showDownloadProgress, setShowDownloadProgress] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
    progress: 0,
    receivedSize: 0,
    totalSize: 0,
    speed: 0,
    fileName: '',
    elapsedTime: 0,
    isZip: false
  });

  // 모바일 환경 감지 - 새로 추가
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // ✅ 다운로드 진행률 업데이트 함수 (전역으로 등록)
  useEffect(() => {
    // 전역 함수로 등록하여 App.js에서 호출할 수 있도록 함
    window.updateDownloadProgress = (progressData) => {
      setDownloadProgress(progressData);
    };
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      delete window.updateDownloadProgress;
    };
  }, []);

  // 부모의 selectedItems가 변경될 때 로컬 상태 업데이트
  useEffect(() => {
    setSelectedItems(parentSelectedItems);
  }, [parentSelectedItems]);

  // 로컬 selectedItems가 변경될 때 부모에게 알림
  useEffect(() => {
    if (onSelectedItemsChange && JSON.stringify(selectedItems) !== JSON.stringify(parentSelectedItems)) {
      onSelectedItemsChange(selectedItems);
    }
  }, [selectedItems, onSelectedItemsChange, parentSelectedItems]);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const newFolderInputRef = useRef(null);
  const uploadButtonRef = useRef(null);
  const fileDisplayRef = useRef(null);

  // 선택 영역 내에 있는 아이템 업데이트
  const updateItemsInSelectionRect = useCallback(() => {
    if (!fileDisplayRef.current) return;
    
    // 정규화된 사각형 계산 (startX가 항상 endX보다 작게)
    const normalizedRect = {
      left: Math.min(selectionRect.startX, selectionRect.endX),
      top: Math.min(selectionRect.startY, selectionRect.endY),
      right: Math.max(selectionRect.startX, selectionRect.endX),
      bottom: Math.max(selectionRect.startY, selectionRect.endY)
    };
    
    // 모든 파일 아이템 요소 가져오기
    const fileItems = fileDisplayRef.current.querySelectorAll('.file-item');
    const fileDisplayRect = fileDisplayRef.current.getBoundingClientRect();
    
    // 현재 선택된 아이템 목록 복사
    // Ctrl 또는 Shift 키가 눌려있을 때 기존 선택 유지
    let newSelectedItems = isCtrlPressed || isShiftPressed ? [...selectedItems] : [];

    // 선택 시작 시 이미 선택된 파일 목록 저장
    const initialSelectedItems = [...newSelectedItems];
    
    // 각 아이템이 선택 영역 내에 있는지 확인
    fileItems.forEach((item) => {
      const itemRect = item.getBoundingClientRect();
      
      // 아이템의 상대적 위치 계산
      const itemLeft = itemRect.left - fileDisplayRect.left;
      const itemTop = itemRect.top - fileDisplayRect.top + fileDisplayRef.current.scrollTop;
      const itemRight = itemRect.right - fileDisplayRect.left;
      const itemBottom = itemRect.bottom - fileDisplayRect.top + fileDisplayRef.current.scrollTop;
      
      // 아이템과 선택 영역이 겹치는지 확인
      const isOverlapping = !(
        itemRight < normalizedRect.left ||
        itemLeft > normalizedRect.right ||
        itemBottom < normalizedRect.top ||
        itemTop > normalizedRect.bottom
      );
      
      // 데이터 속성에서 파일 ID 가져오기
      const fileId = item.getAttribute('data-file-id');
      
      if (fileId) {
        if (isOverlapping) {
          // Ctrl 키가 눌려있을 때: 선택 토글
          if (isCtrlPressed) {
            // 초기 선택에 없던 항목이면서 현재 드래그에 처음 포함된 경우에만 토글
            if (!initialSelectedItems.includes(fileId) && !newSelectedItems.includes(fileId)) {
              newSelectedItems.push(fileId);
            } 
            // 이미 초기 선택에 있었던 항목이 드래그 영역에 포함되면 선택 해제
            else if (initialSelectedItems.includes(fileId) && newSelectedItems.includes(fileId)) {
              newSelectedItems = newSelectedItems.filter(id => id !== fileId);
            }
          } 
          // Shift 키나 일반 드래그: 항상 선택에 추가
          else {
            if (!newSelectedItems.includes(fileId)) {
              newSelectedItems.push(fileId);
            }
          }
          
          // 선택된 스타일 적용 (aria-selected 속성)
          item.setAttribute('aria-selected', 'true');
        } else if (!isCtrlPressed && !isShiftPressed) {
          // Ctrl 또는 Shift 키가 눌려있지 않으면, 선택 영역을 벗어난 항목은 선택 해제
          newSelectedItems = newSelectedItems.filter(id => id !== fileId);
          item.setAttribute('aria-selected', 'false');
        }
      }
    });
    
    // 선택된 아이템 목록 업데이트
    setSelectedItems(newSelectedItems);
  }, [fileDisplayRef, selectionRect, isCtrlPressed, isShiftPressed, selectedItems]);

  // 마우스 다운 이벤트 핸들러 - 드래그 선택 시작
  const handleMouseDown = useCallback((e) => {
    // 모바일에서는 드래그 선택 비활성화
    if (isMobile) return;
    
    // 파일이나 폴더가 아닌 빈 영역을 클릭했을 때만 드래그 선택 시작
    if (e.target === fileDisplayRef.current || e.target.className === 'file-grid') {
      // 마우스 우클릭이면 건너뛰기 (컨텍스트 메뉴용)
      if (e.button === 2) return;
      
      // 파일 영역에 대한 상대적 위치 계산
      const rect = fileDisplayRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top + fileDisplayRef.current.scrollTop;
      
      // 선택 시작점과 선택 영역 초기화
      setSelectionRect({ startX: x, startY: y, endX: x, endY: y });
      setIsDraggingSelection(true);
      
      // Ctrl이나 Shift 키가 눌려있지 않으면 기존 선택 해제
      if (!isCtrlPressed && !isShiftPressed) {
        setSelectedItems([]);
      }
      
      // 이벤트 기본 동작 방지
      e.preventDefault();
    }
  }, [fileDisplayRef, isCtrlPressed, isShiftPressed, isMobile]);

  // 마우스 이동 이벤트 핸들러 - 드래그 선택 업데이트
  const handleMouseMove = useCallback((e) => {
    if (isDraggingSelection && fileDisplayRef.current) {
      const rect = fileDisplayRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top + fileDisplayRef.current.scrollTop;
      
      setSelectionRect(prev => ({
        ...prev,
        endX: x,
        endY: y
      }));
      
      // 선택 영역 내 아이템 계산
      updateItemsInSelectionRect();
    }
  }, [isDraggingSelection, fileDisplayRef, updateItemsInSelectionRect]);

  // 마우스 업 이벤트 핸들러 - 드래그 선택 종료
  const handleMouseUp = useCallback(() => {
    if (isDraggingSelection) {
      // 드래그 선택 완료 시 선택 영역 내의 항목 최종 계산
      updateItemsInSelectionRect();
      
      setIsDraggingSelection(false);
      setJustFinishedDragging(true);
      
      // 짧은 시간 후 드래그 직후 상태 초기화
      setTimeout(() => {
        setJustFinishedDragging(false);
      }, 100); // 100ms 지연
      
      if (selectedItems.length > 0) {
        setLastSelectedItem(selectedItems[selectedItems.length - 1]);
      }
    }
  }, [isDraggingSelection, updateItemsInSelectionRect, selectedItems]);

  // 항목 선택 처리
  const handleItemSelect = (itemId) => {
    // 드래그 선택 중이거나 드래그 직후에는 처리하지 않음
    if (isDraggingSelection || justFinishedDragging) return;
    
    // Ctrl 키가 눌려있는 경우 다중 선택 토글
    if (isCtrlPressed) {
      setSelectedItems(prevSelected => {
        if (prevSelected.includes(itemId)) {
          return prevSelected.filter(id => id !== itemId);
        } else {
          return [...prevSelected, itemId];
        }
      });
      setLastSelectedItem(itemId);
    }
    // Shift 키가 눌려있는 경우 범위 선택
    else if (isShiftPressed && lastSelectedItem) {
      const allIds = files.map(file => file.id);
      const startIdx = allIds.indexOf(lastSelectedItem);
      const endIdx = allIds.indexOf(itemId);
      
      if (startIdx !== -1 && endIdx !== -1) {
        const start = Math.min(startIdx, endIdx);
        const end = Math.max(startIdx, endIdx);
        const selectedRange = allIds.slice(start, end + 1);
        
        setSelectedItems(prevSelected => {
          const newSelection = [...new Set([...prevSelected, ...selectedRange])];
          return newSelection;
        });
      }
    }
    // 일반 클릭은 단일 선택
    else {
      if (selectedItems.includes(itemId) && selectedItems.length === 1) {
        // 이미 선택된 항목을 다시 클릭하면 선택 유지 (원래는 선택 해제)
      } else {
        setSelectedItems([itemId]);
        setLastSelectedItem(itemId);
      }
    }
  };

  // ✅ 다운로드 핸들러
  const handleDownloadSelected = async () => {
    if (selectedItems.length === 0) {
      showNotification('다운로드할 파일을 선택해주세요.');
      return;
    }

    console.log('다운로드 요청:', selectedItems);
    
    try {
      // 다운로드 진행률 모달 표시
      setShowDownloadProgress(true);
      setDownloadProgress({
        progress: 0,
        receivedSize: 0,
        totalSize: 0,
        speed: 0,
        fileName: selectedItems.length === 1 ? 
          files.find(f => f.id === selectedItems[0])?.name || '파일' : 
          `${selectedItems.length}개 파일`,
        elapsedTime: 0,
        isZip: selectedItems.length > 1
      });

      // App.js의 다운로드 함수 호출
      await onDownloadItems(selectedItems);
      
      // 다운로드 완료 후 진행률 모달 숨김
      setTimeout(() => {
        setShowDownloadProgress(false);
        setDownloadProgress({
          progress: 0,
          receivedSize: 0,
          totalSize: 0,
          speed: 0,
          fileName: '',
          elapsedTime: 0,
          isZip: false
        });
      }, 1000); // 1초 후에 모달 숨김
      
    } catch (error) {
      console.error('다운로드 오류:', error);
      setShowDownloadProgress(false);
      showNotification('다운로드 중 오류가 발생했습니다.');
    }
  };

  // ✅ 다운로드 취소 핸들러
  const handleCancelDownload = () => {
    // 다운로드 취소 로직 (AbortController 사용)
    if (window.downloadAbortController) {
      window.downloadAbortController.abort();
    }
    
    setShowDownloadProgress(false);
    setDownloadProgress({
      progress: 0,
      receivedSize: 0,
      totalSize: 0,
      speed: 0,
      fileName: '',
      elapsedTime: 0,
      isZip: false
    });
    
    showNotification('다운로드가 취소되었습니다.');
  };

  // ✅ 바이트를 읽기 쉬운 형태로 변환하는 유틸리티 함수
  const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // ✅ 남은 시간 계산 함수
  const formatRemainingTime = (speed, remainingBytes) => {
    if (speed === 0 || remainingBytes === 0) return '계산 중...';
    
    const remainingSeconds = remainingBytes / speed;
    
    if (remainingSeconds < 60) {
      return `약 ${Math.round(remainingSeconds)}초`;
    } else if (remainingSeconds < 3600) {
      return `약 ${Math.round(remainingSeconds / 60)}분`;
    } else {
      return `약 ${Math.round(remainingSeconds / 3600)}시간`;
    }
  };

  // ✅ 다운로드 속도 형태로 포맷
  const formatSpeed = (bytesPerSecond) => {
    return `${formatBytes(bytesPerSecond)}/초`;
  };

  // 파일 영역 클릭 처리 (빈 공간 클릭시 선택 해제)
  const handleDisplayClick = (e) => {
    // 드래그 직후 클릭은 무시
    if (justFinishedDragging) return;
    
    // 파일이나 폴더 항목 외의 영역 클릭 시 선택 해제
    if (e.target === fileDisplayRef.current || e.target.className === 'file-grid') {
      setSelectedItems([]);
    }
  };

  // 단일 항목 복사 처리
  const handleItemCopy = (item) => {
    setClipboard({ 
      items: [item], 
      operation: 'copy' 
    });
    showNotification(`"${item.name}" 복사됨`);
  };

  // 복사 처리
  const handleCopyItems = useCallback(() => {
    if (selectedItems.length === 0) return;
    
    const itemsToCopy = files.filter(file => selectedItems.includes(file.id));
    setClipboard({ items: itemsToCopy, operation: 'copy' });
    
    // 사용자에게 복사되었음을 알림
    const message = itemsToCopy.length === 1
      ? `"${itemsToCopy[0].name}" 복사됨`
      : `${itemsToCopy.length}개 항목 복사됨`;
    
    showNotification(message);
  }, [selectedItems, files]);

  // 잘라내기 처리
  const handleCutItems = useCallback(() => {
    if (selectedItems.length === 0) return;
    
    const itemsToCut = files.filter(file => selectedItems.includes(file.id));
    setClipboard({ items: itemsToCut, operation: 'cut' });
    
    // 사용자에게 잘라내기되었음을 알림
    const message = itemsToCut.length === 1
      ? `"${itemsToCut[0].name}" 잘라내기됨`
      : `${itemsToCut.length}개 항목 잘라내기됨`;
    
    showNotification(message);
  }, [selectedItems, files]);

  // 붙여넣기 처리 함수 수정
  const handlePasteItems = useCallback(async () => {
    if (clipboard.items.length === 0) return;
    
    try {
      setIsLocalLoading(true);
      
      // 복사 또는 이동 작업 실행
      const operationPromises = clipboard.items.map(async (item) => {
        // 이름 충돌 확인
        const existingFile = files.find(file => file.name === item.name);
        
        if (existingFile && clipboard.operation === 'copy') {
          // 사용자에게 확인
          const useNewName = window.confirm(
            `"${item.name}" 파일이 이미 존재합니다. 복사본을 만드시겠습니까?`
          );
          
          if (!useNewName) {
            // 사용자가 취소
            return null;
          }
        }
        
        // 복사 또는 이동 작업 실행
        if (clipboard.operation === 'copy') {
          return onCopyItem(item.id, currentPath);
        } else {
          return onMoveItem(item.id, currentPath);
        }
      });
      
      // 모든 작업이 완료될 때까지 대기
      await Promise.all(operationPromises.filter(p => p !== null));
      
      // 잘라내기였다면 클립보드 초기화
      if (clipboard.operation === 'cut') {
        setClipboard({ items: [], operation: null });
      }
      
      // 선택 해제
      setSelectedItems([]);
      
      // 성공 메시지
      const message = clipboard.items.length === 1
        ? `"${clipboard.items[0].name}" ${clipboard.operation === 'copy' ? '복사됨' : '이동됨'}`
        : `${clipboard.items.length}개 항목 ${clipboard.operation === 'copy' ? '복사됨' : '이동됨'}`;
      
      showNotification(message);
      
      // 목록 갱신
      onRefresh();
    } catch (error) {
      console.error("Error pasting items:", error);
      showNotification('항목 붙여넣기 중 오류가 발생했습니다');
    } finally {
      setIsLocalLoading(false);
    }
  }, [clipboard, files, currentPath, onCopyItem, onMoveItem, onRefresh]);

  // 선택된 항목 삭제 처리
  const handleDeleteSelectedItems = useCallback(async () => {
    if (selectedItems.length === 0) return;
    
    const confirmMessage = selectedItems.length === 1
      ? `"${files.find(f => f.id === selectedItems[0]).name}"을(를) 삭제하시겠습니까?`
      : `선택한 ${selectedItems.length}개 항목을 삭제하시겠습니까?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        setIsLocalLoading(true);
        
        // 모든 선택된 항목 삭제
        for (const itemId of selectedItems) {
          await onDeleteItem(itemId);
        }
        
        // 선택 해제
        setSelectedItems([]);
        
        // 알림 표시
        showNotification('선택한 항목이 삭제되었습니다');
        
        // 목록 갱신
        onRefresh();
      } catch (error) {
        console.error("Error deleting items:", error);
        showNotification('항목 삭제 중 오류가 발생했습니다');
      } finally {
        setIsLocalLoading(false);
      }
    }
  }, [selectedItems, files, onDeleteItem, onRefresh]);
  
  // 이름 변경 시작
  const startRenameItem = (item) => {
    setItemToRename(item);
    setNewName(item.name);
    setShowRenameModal(true);
  };

  // 이름 변경 제출 핸들러
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!itemToRename || !newName.trim() || newName === itemToRename.name) {
      setShowRenameModal(false);
      return;
    }
    
    try {
      setIsLocalLoading(true);
      await onRenameItem(itemToRename.id, newName);
      
      // 이름 변경 성공 알림
      showNotification(`"${itemToRename.name}"의 이름이 "${newName}"으로 변경되었습니다`);
      
      // 목록 갱신
      onRefresh();
    } catch (error) {
      console.error("Error renaming item:", error);
      showNotification('이름 변경 중 오류가 발생했습니다');
    } finally {
      setIsLocalLoading(false);
      setShowRenameModal(false);
    }
  };
  
  // 이동 모달 열기 함수
  const openMoveDialog = () => {
    if (selectedItems.length === 0) return;
    
    const items = files.filter(file => selectedItems.includes(file.id));
    setItemsToMove(items);
    setTargetPath(currentPath); // 기본값은 현재 경로
    setShowMoveModal(true);
  };

  // 이동 제출 핸들러
  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    if (itemsToMove.length === 0 || !targetPath) {
      setShowMoveModal(false);
      return;
    }
    
    try {
      setIsLocalLoading(true);
      
      // 선택된 모든 항목 이동
      for (const item of itemsToMove) {
        await onMoveItem(item.id, targetPath);
      }
      
      // 이동 성공 알림
      const message = itemsToMove.length === 1
        ? `"${itemsToMove[0].name}"이(가) 이동되었습니다`
        : `${itemsToMove.length}개 항목이 이동되었습니다`;
      
      showNotification(message);
      
      // 선택 해제
      setSelectedItems([]);
      
      // 목록 갱신
      onRefresh();
    } catch (error) {
      console.error("Error moving items:", error);
      showNotification('항목 이동 중 오류가 발생했습니다');
    } finally {
      setIsLocalLoading(false);
      setShowMoveModal(false);
    }
  };
  
  // 단일 항목 이동 처리
  const handleItemMove = (item) => {
    setItemsToMove([item]);
    setTargetPath(currentPath);
    setShowMoveModal(true);
  };

  // 파일 영역 컨텍스트 메뉴 처리
  const handleContextMenu = (e) => {
    e.preventDefault();
    
    // 모바일에서는 컨텍스트 메뉴 처리 방식 변경
    if (isMobile) return;
    
    // 파일이나 폴더가 아닌 빈 영역에서 컨텍스트 메뉴 표시
    if (e.target === fileDisplayRef.current || e.target.className === 'file-grid') {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: 'display' // 파일 표시 영역 컨텍스트 메뉴
      });
    }
  };

  // 터치 시작 이벤트 처리 - 모바일용 (새로 추가)
  const handleTouchStart = useCallback((e) => {
    if (!isMobile) return;
    
    // 모바일에서 꾹 누르기에 대한 처리는 FileItem 컴포넌트에서 담당
  }, [isMobile]);

  // 알림 표시 함수
  const showNotification = (message) => {
    setNotification({ visible: true, message });
    
    // 3초 후 알림 숨기기
    setTimeout(() => {
      setNotification({ visible: false, message: '' });
    }, 3000);
  };

  // ✅ 다운로드 진행률 모달 렌더링 함수
  const renderDownloadProgressModal = () => {
    if (!showDownloadProgress) return null;
    
    const remainingBytes = downloadProgress.totalSize - downloadProgress.receivedSize;
    const remainingTime = formatRemainingTime(downloadProgress.speed, remainingBytes);
    
    return (
      <div className="download-progress-overlay">
        <div className="download-progress-modal">
          <h3>
            {downloadProgress.isZip ? '📦 파일 압축 중...' : '💾 파일 다운로드 중...'}
          </h3>
          
          <div className="progress-info">
            <div className="file-name">
              {downloadProgress.fileName}
            </div>
            
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${downloadProgress.progress}%` }}
              ></div>
            </div>
            
            <div className="progress-details">
              <div className="progress-percent">
                {downloadProgress.progress}%
              </div>
              
              <div className="progress-size">
                {formatBytes(downloadProgress.receivedSize)} / {formatBytes(downloadProgress.totalSize)}
              </div>
              
              <div className="progress-speed">
                속도: {formatSpeed(downloadProgress.speed)}
              </div>
              
              {downloadProgress.speed > 0 && (
                <div className="progress-remaining">
                  남은 시간: {remainingTime}
                </div>
              )}
              
              <div className="progress-elapsed">
                경과 시간: {Math.round(downloadProgress.elapsedTime)}초
              </div>
            </div>
          </div>
          
          <div className="progress-actions">
            <button 
              className="cancel-download-btn"
              onClick={handleCancelDownload}
              disabled={downloadProgress.progress >= 100}
            >
              {downloadProgress.progress >= 100 ? '완료' : '취소'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 키보드 이벤트 리스너 설정
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 단축키 감지는 포커스가 fileDisplay 내부에 있을 때만 작동하도록 설정
      if (!fileDisplayRef.current?.contains(document.activeElement) && 
          document.activeElement.tagName !== 'BODY') {
        return;
      }

      // Control 키 감지
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }
      
      // Shift 키 감지
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      
      // Ctrl + C: 복사
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        if (selectedItems.length > 0) {
          handleCopyItems();
        }
      }
      
      // Ctrl + X: 잘라내기
      if (e.ctrlKey && e.key === 'x') {
        e.preventDefault();
        if (selectedItems.length > 0) {
          handleCutItems();
        }
      }
      
      // Ctrl + V: 붙여넣기
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        if (clipboard.items.length > 0) {
          handlePasteItems();
        }
      }
      
      // Delete: 삭제
      if (e.key === 'Delete') {
        e.preventDefault();
        if (selectedItems.length > 0) {
          handleDeleteSelectedItems();
        }
      }
      
      // F2: 이름 변경
      if (e.key === 'F2' && selectedItems.length === 1) {
        e.preventDefault();
        const selectedItem = files.find(file => file.id === selectedItems[0]);
        if (selectedItem) {
          startRenameItem(selectedItem);
        }
      }
      
      // Escape: 선택 해제
      if (e.key === 'Escape') {
        setSelectedItems([]);
      }
      
      // Ctrl + A: 전체 선택
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedItems(files.map(file => file.id));
      }

      // Ctrl + D: 다운로드 (브라우저 북마크 기본 동작 방지)
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (selectedItems.length > 0) {
          handleDownloadSelected();
        }
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
      }
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selectedItems, 
    clipboard, 
    files, 
    handleCopyItems, 
    handleCutItems, 
    handlePasteItems, 
    handleDeleteSelectedItems,
    handleDownloadSelected, // 새로 추가
    isDownloading // 새로 추가
  ]);

  // 드래그 선택을 위한 이벤트 리스너 추가
  useEffect(() => {
    // 모바일에서는 드래그 선택 이벤트를 등록하지 않음
    if (isMobile) return;
    
    const fileDisplayEl = fileDisplayRef.current;
    
    if (fileDisplayEl) {
      fileDisplayEl.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        fileDisplayEl.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [
    isDraggingSelection,
    selectionRect,
    isCtrlPressed,
    isShiftPressed,
    justFinishedDragging,
    selectedItems,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isMobile
  ]);

  // 컨텍스트 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleDocumentClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [contextMenu]);

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

      // 모바일에서는 지원하지 않음 (새로 추가)
      if (isMobile) {
        showNotification('모바일에서는 파일 드래그 앤 드롭이 지원되지 않습니다. 업로드 버튼을 사용해주세요.');
        return;
      }

      // 드롭된 항목에 폴더가 포함되어 있는지 확인
      // webkitGetAsEntry API 사용
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const items = Array.from(e.dataTransfer.items);
        
        // 각 항목이 파일인지 폴더인지 확인
        const entries = items.map(item => item.webkitGetAsEntry());
        
        // 엔트리 처리
        handleEntries(entries);
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // 일반 파일 처리 (폴더 구조 없음)
        handleFiles(e.dataTransfer.files);
      }
    };

  // 드롭된 엔트리(파일/폴더) 처리
  const handleEntries = async (entries) => {
    console.log('===== 드래그 앤 드롭 디버깅 정보 =====');
    console.log('드롭된 항목 수:', entries.length);
    console.log('드롭된 항목 타입:', entries.map(entry => ({ 
      name: entry.name, 
      isFile: entry.isFile, 
      isDirectory: entry.isDirectory 
    })));
    
    setIsUploading(true);
    
    try {
      // 파일만 모으기
      const allFiles = [];
      const dirStructure = {};
      
      for (const entry of entries) {
        if (entry.isFile) {
          // 파일인 경우 직접 추가
          console.log('파일 처리 중:', entry.name);
          const file = await getFileFromEntry(entry);
          allFiles.push(file);
        } else if (entry.isDirectory) {
          // 폴더인 경우 재귀적으로 처리
          console.log('폴더 처리 중:', entry.name);
          const result = await processDirectory(entry, entry.name);
          allFiles.push(...result.files);
          
          // 디렉토리 구조 정보 추가
          dirStructure[entry.name] = result.structure;
          console.log(`폴더 '${entry.name}' 처리 완료:`, {
            files: result.files.length,
            structure: result.structure
          });
        }
      }
      
      console.log('총 수집된 파일 수:', allFiles.length);
      console.log('디렉토리 구조:', dirStructure);
      
      // 서버에 파일 및 디렉토리 구조 전송
      if (allFiles.length > 0) {
        await onAddFile(allFiles, currentPath, dirStructure);
        console.log('서버에 파일 및 구조 전송 완료');
      }
    } catch (error) {
      console.error("Error processing dropped items:", error);
    } finally {
      setIsUploading(false);
      console.log('===== 드래그 앤 드롭 디버깅 정보 종료 =====');
    }
  };

  // 파일 엔트리에서 File 객체 가져오기
  const getFileFromEntry = (fileEntry) => {
    return new Promise((resolve, reject) => {
      fileEntry.file(
        file => {
          // 원래 경로 정보 추가
          file.relativePath = fileEntry.fullPath;
          console.log('파일 경로 정보 추가:', {
            name: file.name,
            relativePath: file.relativePath
          });
          resolve(file);
        },
        error => {
          console.error('파일 엔트리에서 파일 가져오기 실패:', error);
          reject(error);
        }
      );
    });
  };

  // 디렉토리 재귀 처리
  const processDirectory = async (dirEntry, path) => {
    console.log(`디렉토리 처리 시작: ${path}`);
    const dirReader = dirEntry.createReader();
    const files = [];
    const structure = {};
    
    // readEntries는 모든 항목을 한 번에 반환하지 않을 수 있음
    const readAllEntries = async () => {
      return new Promise((resolve, reject) => {
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              console.log(`디렉토리 '${path}' 모든 항목 읽기 완료`);
              resolve();
            } else {
              console.log(`디렉토리 '${path}' 항목 ${entries.length}개 읽기 중...`);
              for (const entry of entries) {
                if (entry.isFile) {
                  const file = await getFileFromEntry(entry);
                  files.push(file);
                } else if (entry.isDirectory) {
                  const subPath = `${path}/${entry.name}`;
                  console.log(`서브디렉토리 발견: ${subPath}`);
                  const result = await processDirectory(entry, subPath);
                  files.push(...result.files);
                  structure[entry.name] = result.structure;
                }
              }
              readEntries(); // 더 많은 항목이 있을 수 있으므로 다시 호출
            }
          }, error => {
            console.error(`디렉토리 '${path}' 읽기 오류:`, error);
            reject(error);
          });
        };
        
        readEntries();
      });
    };
    
    await readAllEntries();
    console.log(`디렉토리 '${path}' 처리 완료:`, {
      filesCount: files.length,
      structureKeys: Object.keys(structure)
    });
    return { files, structure };
  };

  // Handle file input change (from button click)
  const handleFileInputChange = (e) => {
    console.log('===== 파일 업로드 디버깅 정보 =====');
    if (e.target.files && e.target.files.length > 0) {
      const files = e.target.files;
      console.log('선택된 파일 수:', files.length);
      console.log('선택된 파일 목록:', Array.from(files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      })));
      
      // 현재 경로를 기반으로 디렉토리 구조 생성
      const dirStructure = createDirectoryStructureForCurrentPath();
      console.log('생성된 디렉토리 구조:', dirStructure);
      
      handleFiles(files, dirStructure);
    } else {
      console.log('선택된 파일 없음');
    }
    console.log('===== 파일 업로드 디버깅 정보 종료 =====');
  };
  
  const createDirectoryStructureForCurrentPath = () => {
    // 현재 경로가 루트('/')인 경우 빈 객체 반환
    if (currentPath === '/') {
      return {};
    }
    
    // 현재 경로를 폴더 이름으로 분리
    const pathParts = currentPath.split('/').filter(Boolean);
    
    // 폴더 구조 객체 생성
    let structure = {};
    let currentLevel = structure;
    
    // 경로의 각 부분을 중첩된 객체로 변환
    for (let i = 0; i < pathParts.length; i++) {
      const folder = pathParts[i];
      if (i === pathParts.length - 1) {
        // 마지막 폴더는 파일이 추가될 위치
        currentLevel[folder] = {};
      } else {
        // 중간 폴더는 다음 레벨의 부모
        currentLevel[folder] = {};
        currentLevel = currentLevel[folder];
      }
    }
    
    return structure;
  };

  // Handle folder input change
  const handleFolderInputChange = (e) => {
    console.log('===== 폴더 업로드 디버깅 정보 =====');
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      console.log('선택된 총 파일 수:', files.length);
      
      // 폴더 구조 파악을 위한 경로 샘플 출력
      const samplePaths = files.slice(0, Math.min(5, files.length)).map(file => file.webkitRelativePath);
      console.log('파일 경로 샘플:', samplePaths);
      
      // 폴더 구조 파악
      const dirStructure = {};
      const filesByPath = {};
      
      files.forEach(file => {
        // 웹킷에서 파일 경로 가져오기
        const relativePath = file.webkitRelativePath;
        
        if (relativePath) {
          const parts = relativePath.split('/');
          const rootDir = parts[0];
          
          // 루트 디렉토리 구조 초기화
          if (!dirStructure[rootDir]) {
            dirStructure[rootDir] = {};
            console.log(`루트 디렉토리 발견: ${rootDir}`);
          }
          
          // 전체 경로에서 서브 디렉토리 구조 구축
          let currentLevel = dirStructure[rootDir];
          for (let i = 1; i < parts.length - 1; i++) {
            if (!currentLevel[parts[i]]) {
              currentLevel[parts[i]] = {};
            }
            currentLevel = currentLevel[parts[i]];
          }
          
          // 파일 정보 저장
          if (!filesByPath[rootDir]) {
            filesByPath[rootDir] = [];
          }
          filesByPath[rootDir].push(file);
        }
      });
      
      console.log('구성된 디렉토리 구조:', dirStructure);
      console.log('루트 폴더별 파일 수:', Object.keys(filesByPath).map(key => ({
        folder: key,
        fileCount: filesByPath[key].length
      })));
      
      // 파일 및 구조 정보 전송
      handleFiles(files, dirStructure);
    } else {
      console.log('선택된 폴더 없음');
    }
    console.log('===== 폴더 업로드 디버깅 정보 종료 =====');
  };

  // Process the files
  const handleFiles = async (fileList, dirStructure = null) => {
    if (!fileList || fileList.length === 0) return;
  
    console.log('===== 파일 처리 디버깅 정보 =====');
    console.log('처리할 파일 수:', fileList.length);
    console.log('디렉토리 구조 존재 여부:', dirStructure ? '있음' : '없음');
    
    setIsUploading(true);
    try {
      await onAddFile(fileList, currentPath, dirStructure);
      console.log('onAddFile 함수 호출 완료');
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        console.log('파일 입력 필드 초기화 완료');
      }
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
        console.log('폴더 입력 필드 초기화 완료');
      }
      
      // 성공 알림 표시 (새로 추가)
      const fileCount = fileList.length;
      showNotification(`${fileCount}개 파일을 성공적으로 업로드했습니다.`);
      
    } catch (error) {
      console.error("Error handling files:", error);
      showNotification('파일 업로드 중 오류가 발생했습니다');
    } finally {
      setIsUploading(false);
      console.log('===== 파일 처리 디버깅 정보 종료 =====');
    }
  };

  // 업로드 버튼 클릭 시 메뉴 표시/숨김
  const handleUploadButtonClick = () => {
    setShowUploadTypeMenu(!showUploadTypeMenu);
  };

  // 파일 업로드 선택
  const handleFileUploadClick = () => {
    setShowUploadTypeMenu(false);
    fileInputRef.current.click();
  };

  // 폴더 업로드 선택
  const handleFolderUploadClick = () => {
    setShowUploadTypeMenu(false);
    // 모바일에서 폴더 업로드 지원 확인 (새로 추가)
    if (isMobile && !('webkitdirectory' in document.createElement('input'))) {
      showNotification('현재 브라우저에서는 폴더 업로드가 지원되지 않습니다.');
      return;
    }
    folderInputRef.current.click();
  };

  // 메뉴 외부 클릭 처리
  const handleDocumentClick = useCallback((e) => {
    if (
      showUploadTypeMenu && 
      uploadButtonRef.current && 
      !uploadButtonRef.current.contains(e.target)
    ) {
      setShowUploadTypeMenu(false);
    }
  }, [showUploadTypeMenu]);

  // useEffect에 의존성 배열 추가
  useEffect(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [handleDocumentClick]); // handleDocumentClick 의존성 추가

  // Show new folder modal
  const handleNewFolderClick = () => {
    setShowNewFolderModal(true);
    setNewFolderName("");
    setTimeout(() => {
      if (newFolderInputRef.current) {
        newFolderInputRef.current.focus();
      }
    }, 100);
  };

  // Create new folder
  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (newFolderName.trim() && onCreateFolder) {
      onCreateFolder(newFolderName);
      setNewFolderName("");
      setShowNewFolderModal(false);
    }
  };

  // Cancel new folder creation
  const handleCancelNewFolder = () => {
    setNewFolderName("");
    setShowNewFolderModal(false);
  };

  // Handle folder modal click outside
  const handleModalOutsideClick = (e) => {
    if (e.target.className === "folder-modal-overlay") {
      handleCancelNewFolder();
    }
  };

  // 파일/폴더 삭제 처리
  const handleItemDelete = (itemId) => {
    if (onDeleteItem) {
      onDeleteItem(itemId);
    }
  };

  // 파일/폴더 이름 변경 처리
  const handleItemRename = (itemId, renamedName) => {
    if (onRenameItem) {
      onRenameItem(itemId, renamedName);
    }
  };

  // Handle file or folder click - 수정된 부분
  const handleItemClick = (file) => {
    // 모바일에서 폴더인 경우의 특별 처리
    if (isMobile && (file.isDirectory || file.type === 'folder')) {
      // 이미 선택된 폴더를 다시 클릭한 경우 폴더로 들어가기
      if (selectedItems.includes(file.id) && selectedItems.length === 1) {
        // 선택된 폴더를 다시 클릭하면 폴더로 들어가기
        const newPath = currentPath === "/" 
          ? `/${file.name}` 
          : `${currentPath}/${file.name}`;
        
        onFolderOpen(newPath);
        
        // 선택 해제
        setSelectedItems([]);
        return;
      }
    }
    
    // 항목 선택 처리
    handleItemSelect(file.id);
  };

  // Handle file or folder double click - 수정된 부분
  const handleItemDoubleClick = (file) => {
    // 데스크톱에서만 더블클릭으로 폴더 열기
    if (!isMobile && (file.isDirectory || file.type === 'folder')) {
      // 현재 경로에 폴더명을 추가
      const newPath = currentPath === "/" 
        ? `/${file.name}` 
        : `${currentPath}/${file.name}`;
      
      onFolderOpen(newPath);
    }
    // 파일인 경우 미리보기나 다운로드 기능 추가 가능
  };
  
  // 현재 경로를 쉽게 탐색할 수 있는 경로 표시줄 생성
  const renderBreadcrumbs = () => {
    if (currentPath === "/") {
      return <span className="breadcrumb-item active">홈</span>;
    }

    const paths = currentPath.split('/').filter(Boolean);
    
    // 모바일 환경에서는 경로가 길어질 경우 생략 처리 (새로 추가)
    if (isMobile && paths.length > 2) {
      return (
        <>
          <span 
            className="breadcrumb-item" 
            onClick={() => onFolderOpen("/")}
          >
            홈
          </span>
          {paths.length > 2 && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item ellipsis">...</span>
            </>
          )}
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-item active">
            {paths[paths.length - 1]}
          </span>
        </>
      );
    }

    // 데스크톱 환경에서는 모든 경로 표시
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
                className={`breadcrumb-item ${isLast ? 'active' : ''} ${isMobile ? 'truncate-on-mobile' : ''}`}
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

  // 모바일 파일 액션 메뉴 렌더링 (새로 추가)
  const renderMobileActionMenu = () => {
    if (!isMobile) return null;
    
    return (
      <div className="mobile-action-menu">
        <button 
          className="mobile-action-btn new-folder-btn" 
          onClick={handleNewFolderClick}
          disabled={isLoading || isLocalLoading}
          aria-label="새 폴더"
        >
          <span className="mobile-action-icon">📁+</span>
        </button>
        <button 
          className="mobile-action-btn download-btn" 
          onClick={handleDownloadSelected}
          disabled={isLoading || isLocalLoading || selectedItems.length === 0 || isDownloading}
          aria-label="다운로드"
        >
          <span className="mobile-action-icon">⬇️</span>
          <span className="mobile-action-text">다운로드</span>
        </button>
        <div className="mobile-upload-dropdown" ref={uploadButtonRef}>
          <button
            className="mobile-action-btn upload-btn"
            onClick={handleUploadButtonClick}
            disabled={isUploading || isLoading || isLocalLoading}
            aria-label="업로드"
          >
            <span className="mobile-action-icon">📤</span>
          </button>
          {showUploadTypeMenu && (
            <div className="mobile-upload-menu">
              <div className="mobile-upload-menu-item" onClick={handleFileUploadClick}>
                파일 업로드
              </div>
              <div className="mobile-upload-menu-item" onClick={handleFolderUploadClick}>
                폴더 업로드
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`file-display ${isDragging ? "dragging" : ""} ${(isLoading || isLocalLoading) ? "loading" : ""} ${isMobile ? "mobile-view" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onClick={handleDisplayClick}
      onTouchStart={handleTouchStart}
      ref={fileDisplayRef}
    >
      <div className="file-display-header">
        <div className="path-navigator">
          {renderBreadcrumbs()}
        </div>

        {/* 다운로드 프로그레스 바 */}
        {downloadProgress.visible && (
          <div className="download-progress-overlay">
            <div className="download-progress-modal">
              <h3>다운로드 진행 중</h3>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${downloadProgress.percent}%` }}
                ></div>
              </div>
              <p className="progress-message">{downloadProgress.message}</p>
              <div className="progress-percent">{downloadProgress.percent}%</div>
            </div>
          </div>
        )}
        
        {/* 모바일 환경에서 꾹 누르기 힌트 표시 */}
        {isMobile && (
          <div className="mobile-context-hint">
            항목을 길게 누르면 옵션 메뉴가 표시됩니다
          </div>
        )}
        
        {/* 선택된 아이템 수 표시 (디버깅용) */}
        {selectedItems.length > 0 && (
          <div style={{ 
            padding: '5px 10px', 
            backgroundColor: 'var(--highlight-color)', 
            color: 'white', 
            borderRadius: '4px', 
            fontSize: '12px',
            marginBottom: '10px'
          }}>
            선택된 파일: {selectedItems.length}개
            {selectedItems.length <= 3 && (
              <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.9 }}>
                {selectedItems.map(id => {
                  const file = files.find(f => f.id === id);
                  return file ? file.name : `[ID:${id}]`;
                }).join(', ')}
              </div>
            )}
          </div>
        )}
        
        {/* 디버깅용 정보 패널 (개발 환경에서만 표시) */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            padding: '8px 12px', 
            backgroundColor: 'var(--bg-tertiary)', 
            borderRadius: '4px', 
            fontSize: '11px',
            marginBottom: '10px',
            border: '1px dashed var(--border-color)'
          }}>
            <strong>🐛 디버깅 정보:</strong><br/>
            현재 경로: {currentPath} | 
            전체 파일: {files.length}개 | 
            선택된 파일: {selectedItems.length}개
            {selectedItems.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                선택된 파일들: {selectedItems.map(id => {
                  const file = files.find(f => f.id === id);
                  return file ? file.name : `[ID:${id}]`;
                }).join(', ')}
              </div>
            )}
          </div>
        )}
        
        {/* 도구 모음 추가 - 모바일에서는 숨김 */}
        {!isMobile && (
          <div className="toolbar">
            <button 
              className="toolbar-btn"
              onClick={handleCopyItems}
              disabled={selectedItems.length === 0 || isLoading || isLocalLoading}
              title="복사 (Ctrl+C)"
            >
              복사
            </button>
            <button 
              className="toolbar-btn"
              onClick={handleCutItems}
              disabled={selectedItems.length === 0 || isLoading || isLocalLoading}
              title="잘라내기 (Ctrl+X)"
            >
              잘라내기
            </button>
            <button 
              className="toolbar-btn"
              onClick={handlePasteItems}
              disabled={clipboard.items.length === 0 || isLoading || isLocalLoading}
              title="붙여넣기 (Ctrl+V)"
            >
              붙여넣기
            </button>
            <div className="toolbar-separator"></div>
            <button 
              className="toolbar-btn"
              onClick={() => selectedItems.length === 1 && startRenameItem(files.find(f => f.id === selectedItems[0]))}
              disabled={selectedItems.length !== 1 || isLoading || isLocalLoading}
              title="이름 변경 (F2)"
            >
              이름 변경
            </button>
            <button 
              className="toolbar-btn"
              onClick={openMoveDialog}
              disabled={selectedItems.length === 0 || isLoading || isLocalLoading}
              title="이동"
            >
              이동
            </button>
            <button 
              className="toolbar-btn delete-btn"
              onClick={handleDeleteSelectedItems}
              disabled={selectedItems.length === 0 || isLoading || isLocalLoading}
              title="삭제 (Delete)"
            >
              삭제
            </button>
          </div>
        )}
        
        {/* 데스크톱 파일 액션 버튼 - 모바일에서는 숨김 */}
        {!isMobile ? (
          <div className="file-actions">
            <button 
              className="new-folder-btn" 
              onClick={handleNewFolderClick}
              disabled={isLoading || isLocalLoading}
            >
              새 폴더
            </button>
            <button 
              className="download-btn" 
              onClick={handleDownloadSelected}
              disabled={selectedItems.length === 0 || isLoading || isLocalLoading || isDownloading}
              title={selectedItems.length === 0 ? '다운로드할 항목을 선택하세요' : `${selectedItems.length}개 항목 다운로드`}
            >
              {isDownloading ? '다운로드 중...' : `다운로드${selectedItems.length > 0 ? ` (${selectedItems.length})` : ''}`}
            </button>
            <div className="upload-dropdown" ref={uploadButtonRef}>
              <button
                className="upload-btn"
                onClick={handleUploadButtonClick}
                disabled={isUploading || isLoading || isLocalLoading}
              >
                {isUploading ? "업로드 중..." : "업로드"}
              </button>
              {showUploadTypeMenu && (
                <div className="upload-menu">
                  <div className="upload-menu-item" onClick={handleFileUploadClick}>
                    파일 업로드
                  </div>
                  <div className="upload-menu-item" onClick={handleFolderUploadClick}>
                    폴더 업로드
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // 모바일 파일 액션 메뉴 (아이콘 버튼 형태)
          renderMobileActionMenu()
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileInputChange}
          multiple
          accept=".pdf,.docx,.doc,.hwp,.hwpx,.xlsx,.xls,.txt,.jpg,.jpeg,.png,.gif"
        />
        <input
          type="file"
          ref={folderInputRef}
          style={{ display: "none" }}
          onChange={handleFolderInputChange}
          webkitdirectory="true"
          directory="true"
        />
      </div>

      <div className="file-grid">
        {(isLoading || isLocalLoading) ? (
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
              onDoubleClick={() => handleItemDoubleClick(file)}
              onDelete={() => handleItemDelete(file.id)}
              onRename={(newName) => handleItemRename(file.id, newName)}
              onMove={handleItemMove}
              onCopy={handleItemCopy}
              isSelected={selectedItems.includes(file.id)}
              data-file-id={file.id}
              isMobile={isMobile}
            />
          ))
        ) : (
          <div className="empty-message">
            <p>이 폴더에 파일이 없습니다</p>
            <p className="drop-message">
              {isMobile 
                ? '업로드 버튼을 사용하여 파일을 추가하세요'
                : '여기에 파일이나 폴더를 끌어서 놓거나 업로드 버튼을 사용하세요'}
            </p>
          </div>
        )}
      </div>

      {/* 드래그 선택 영역 표시 - 모바일에서는 비활성화 */}
      {!isMobile && isDraggingSelection && (
        <div 
          className="selection-rect"
          style={{
            position: 'absolute',
            left: Math.min(selectionRect.startX, selectionRect.endX) + 'px',
            top: Math.min(selectionRect.startY, selectionRect.endY) + 'px',
            width: Math.abs(selectionRect.endX - selectionRect.startX) + 'px',
            height: Math.abs(selectionRect.endY - selectionRect.startY) + 'px',
            backgroundColor: 'rgba(65, 105, 225, 0.2)',
            border: '1px solid rgba(65, 105, 225, 0.5)',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />
      )}

      {/* 드롭 오버레이 - 모바일에서는 비활성화 */}
      {!isMobile && isDragging && (
        <div className="drop-overlay">
          <div className="drop-message">
            <p>파일 또는 폴더를 여기에 놓아 업로드</p>
          </div>
        </div>
      )}
      
      {/* 새 폴더 생성 모달 */}
      {showNewFolderModal && (
        <div className="folder-modal-overlay" onClick={handleModalOutsideClick}>
          <div className={`folder-modal ${isMobile ? 'mobile-modal' : ''}`}>
            <div className="folder-modal-header">
              <h3>새 폴더 만들기</h3>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="folder-modal-content">
                <label htmlFor="folderName">폴더 이름:</label>
                <input
                  type="text"
                  id="folderName"
                  ref={newFolderInputRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="새 폴더 이름을 입력하세요"
                  className="folder-name-input"
                />
              </div>
              <div className="folder-modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={handleCancelNewFolder}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="create-btn"
                  disabled={!newFolderName.trim()}
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 이름 변경 모달 */}
      {showRenameModal && (
        <div className="folder-modal-overlay" onClick={(e) => {
          if (e.target.className === "folder-modal-overlay") {
            setShowRenameModal(false);
          }
        }}>
          <div className={`folder-modal ${isMobile ? 'mobile-modal' : ''}`}>
            <div className="folder-modal-header">
              <h3>이름 변경</h3>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <div className="folder-modal-content">
                <label htmlFor="newName">새 이름:</label>
                <input
                  type="text"
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="새 이름을 입력하세요"
                  className="folder-name-input"
                  autoFocus
                />
              </div>
              <div className="folder-modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowRenameModal(false)}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="create-btn"
                  disabled={!newName.trim() || newName === itemToRename?.name}
                >
                  변경
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 이동 모달 */}
      {showMoveModal && (
        <div className="folder-modal-overlay" onClick={(e) => {
          if (e.target.className === "folder-modal-overlay") {
            setShowMoveModal(false);
          }
        }}>
          <div className={`folder-modal ${isMobile ? 'mobile-modal' : ''}`}>
            <div className="folder-modal-header">
              <h3>항목 이동</h3>
            </div>
            <form onSubmit={handleMoveSubmit}>
              <div className="folder-modal-content move-modal-content">
                <p>{itemsToMove.length}개 항목을 이동합니다</p>
                <label htmlFor="targetPath">대상 경로:</label>
                <select
                  id="targetPath"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  className="folder-name-input"
                >
                  <option value="/">홈</option>
                  {/* 디렉토리 목록을 옵션으로 표시 */}
                  {directories.map(dir => (
                    dir.path !== '/' && (
                      <option key={dir.id} value={dir.path}>
                        {dir.path}
                      </option>
                    )
                  ))}
                </select>
              </div>
              <div className="folder-modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowMoveModal(false)}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="create-btn"
                >
                  이동
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ 다운로드 진행률 모달 추가 */}
      {renderDownloadProgressModal()}

      {/* 컨텍스트 메뉴 */}
      {contextMenu.visible && contextMenu.type === 'display' && (
        <div 
          className="context-menu" 
          style={{ 
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`
          }}
        >
          <div 
            className="context-menu-item" 
            onClick={handlePasteItems}
            style={{ opacity: clipboard.items.length > 0 ? 1 : 0.5 }}
          >
            붙여넣기
          </div>
          <div className="context-menu-item" onClick={handleNewFolderClick}>
            새 폴더
          </div>
          <div 
            className="context-menu-item" 
            onClick={openMoveDialog}
            style={{ opacity: selectedItems.length > 0 ? 1 : 0.5 }}
          >
            선택 항목 이동
          </div>
          <div 
            className="context-menu-item delete-item" 
            onClick={handleDeleteSelectedItems}
            style={{ opacity: selectedItems.length > 0 ? 1 : 0.5 }}
          >
            선택 항목 삭제
          </div>
          <div 
            className="context-menu-item" 
            onClick={handleDownloadSelected}
            style={{ opacity: selectedItems.length > 0 ? 1 : 0.5 }}
          >
            선택 항목 다운로드
          </div>
        </div>
      )}

      {/* 알림 */}
      {notification.visible && (
        <div className={`notification ${isMobile ? 'mobile-notification' : ''}`}>
          {notification.message}
        </div>
      )}
      
      {/* 모바일 하단 액션 바 - 파일만 선택된 경우에만 표시 (폴더 제외) */}
      {isMobile && selectedItems.length > 0 && !selectedItems.some(id => {
        const file = files.find(f => f.id === id);
        return file && (file.isDirectory || file.type === 'folder');
      }) && (
        <div className="mobile-action-bar">
          <button 
            className="mobile-action-bar-btn"
            onClick={handleCopyItems}
            disabled={isLoading || isLocalLoading}
          >
            복사
          </button>
          <button 
            className="mobile-action-bar-btn"
            onClick={handleCutItems}
            disabled={isLoading || isLocalLoading}
          >
            잘라내기
          </button>
          <button 
            className="mobile-action-bar-btn"
            onClick={openMoveDialog}
            disabled={isLoading || isLocalLoading}
          >
            이동
          </button>
          <button 
            className="mobile-action-bar-btn delete-btn"
            onClick={handleDeleteSelectedItems}
            disabled={isLoading || isLocalLoading}
          >
            삭제
          </button>
          <button 
            className="mobile-action-bar-btn download-btn"
            onClick={handleDownloadSelected}
            disabled={isLoading || isLocalLoading || isDownloading}
          >
            다운로드
          </button>
        </div>
      )}
      
      {/* 모바일 바텀 시트 메뉴 - 파일 옵션 */}
      {isMobile && clipboard.items.length > 0 && (
        <div className="mobile-paste-button" onClick={handlePasteItems}>
          붙여넣기 ({clipboard.items.length})
        </div>
      )}
    </div>
  );
};

export default FileDisplay;