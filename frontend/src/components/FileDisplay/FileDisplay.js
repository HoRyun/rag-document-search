import React, { useState, useRef, useEffect, useCallback } from "react";
import FileItem from "../FileItem/FileItem";
import "./FileDisplay.css";

const FileDisplay = ({ files, directories, currentPath, onAddFile, onCreateFolder, onMoveItem, onDeleteItem, onRenameItem, onFolderOpen, onRefresh, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showUploadTypeMenu, setShowUploadTypeMenu] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  // 파일 선택 및 클립보드 관련 상태 추가
  const [selectedItems, setSelectedItems] = useState([]);
  const [clipboard, setClipboard] = useState({ items: [], operation: null }); // operation: 'copy' 또는 'cut'
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [lastSelectedItem, setLastSelectedItem] = useState(null);

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

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const newFolderInputRef = useRef(null);
  const uploadButtonRef = useRef(null);
  const fileDisplayRef = useRef(null);

  // 항목 선택 처리
  const handleItemSelect = (itemId) => {
    // Ctrl 키가 눌려있는 경우 다중 선택
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
        // 이미 선택된 항목을 다시 클릭하면 선택 해제
        setSelectedItems([]);
      } else {
        setSelectedItems([itemId]);
        setLastSelectedItem(itemId);
      }
    }
  };

  // 파일 영역 클릭 처리 (빈 공간 클릭시 선택 해제)
  const handleDisplayClick = (e) => {
    // 파일이나 폴더 항목 외의 영역 클릭 시 선택 해제
    if (e.target === fileDisplayRef.current || e.target.className === 'file-grid') {
      setSelectedItems([]);
    }
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

  // 붙여넣기 처리
  const handlePasteItems = useCallback(async () => {
    if (clipboard.items.length === 0) return;
    
    try {
      setIsLocalLoading(true);
      
      // 복사 또는 이동 작업 실행
      for (const item of clipboard.items) {
        // 이름 충돌 처리 - 같은 이름의 파일이 있는지 확인
        const existingFile = files.find(file => file.name === item.name);
        
        if (existingFile && clipboard.operation === 'copy') {
          // 사용자에게 확인 또는 자동으로 새 이름 생성
          // 백엔드 연동 시 이름 충돌 처리를 위한 코드 (현재는 주석 처리)
          // const nameParts = item.name.split('.');
          // const ext = nameParts.length > 1 ? '.' + nameParts.pop() : '';
          // const baseName = nameParts.join('.');
          // const newFileName = `${baseName} - 복사본${ext}`;
          
          // 백엔드 연동 또는 새 이름 지정 로직은 향후 구현 예정
          console.log('파일 이름 충돌 감지:', item.name);
        }
        
        if (clipboard.operation === 'copy') {
          // 복사 구현: 현재는 백엔드 API 연동이 필요하므로 실제 구현은 생략
          // 알림 표시
          showNotification('복사된 항목을 백엔드에 저장하는 기능은 아직 구현되지 않았습니다');
        } else if (clipboard.operation === 'cut') {
          // 이동 구현: onMoveItem 함수 호출
          await onMoveItem(item.id, currentPath);
        }
      }
      
      // 붙여넣기 후 클립보드 초기화 (cut인 경우만)
      if (clipboard.operation === 'cut') {
        setClipboard({ items: [], operation: null });
      }
      
      // 선택 해제
      setSelectedItems([]);
      
      // 목록 갱신
      onRefresh();
    } catch (error) {
      console.error("Error pasting items:", error);
      showNotification('항목 붙여넣기 중 오류가 발생했습니다');
    } finally {
      setIsLocalLoading(false);
    }
  }, [clipboard, files, currentPath, onMoveItem, onRefresh]);const handlePasteItems = useCallback(async () => {
    if (clipboard.items.length === 0) return;
    
    try {
      setIsLocalLoading(true);
      
      // 복사 또는 이동 작업 실행
      for (const item of clipboard.items) {
        // 이름 충돌 처리 - 같은 이름의 파일이 있는지 확인
        const existingFile = files.find(file => file.name === item.name);
        
        if (existingFile && clipboard.operation === 'copy') {
          // 사용자에게 확인 또는 자동으로 새 이름 생성
          // 백엔드 연동 시 이름 충돌 처리를 위한 코드 (현재는 주석 처리)
          // const nameParts = item.name.split('.');
          // const ext = nameParts.length > 1 ? '.' + nameParts.pop() : '';
          // const baseName = nameParts.join('.');
          // const newFileName = `${baseName} - 복사본${ext}`;
          
          // 백엔드 연동 또는 새 이름 지정 로직은 향후 구현 예정
          console.log('파일 이름 충돌 감지:', item.name);
        }
        
        if (clipboard.operation === 'copy') {
          // 복사 구현: 현재는 백엔드 API 연동이 필요하므로 실제 구현은 생략
          // 알림 표시
          showNotification('복사된 항목을 백엔드에 저장하는 기능은 아직 구현되지 않았습니다');
        } else if (clipboard.operation === 'cut') {
          // 이동 구현: onMoveItem 함수 호출
          await onMoveItem(item.id, currentPath);
        }
      }
      
      // 붙여넣기 후 클립보드 초기화 (cut인 경우만)
      if (clipboard.operation === 'cut') {
        setClipboard({ items: [], operation: null });
      }
      
      // 선택 해제
      setSelectedItems([]);
      
      // 목록 갱신
      onRefresh();
    } catch (error) {
      console.error("Error pasting items:", error);
      showNotification('항목 붙여넣기 중 오류가 발생했습니다');
    } finally {
      setIsLocalLoading(false);
    }
  }, [clipboard, files, currentPath, onMoveItem, onRefresh]);

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

  // 알림 표시 함수
  const showNotification = (message) => {
    setNotification({ visible: true, message });
    
    // 3초 후 알림 숨기기
    setTimeout(() => {
      setNotification({ visible: false, message: '' });
    }, 3000);
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
    handleDeleteSelectedItems
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
  
  // Refresh file list
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

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

  // Handle file or folder click
  const handleItemClick = (file) => {
    // 항목 선택 처리
    handleItemSelect(file.id);
  };

  // Handle file or folder double click
  const handleItemDoubleClick = (file) => {
    if (file.isDirectory || file.type === 'folder') {
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
                className={`breadcrumb-item ${isLast ? 'active' : ''}`}
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

  return (
    <div
      className={`file-display ${isDragging ? "dragging" : ""} ${(isLoading || isLocalLoading) ? "loading" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onClick={handleDisplayClick}
      ref={fileDisplayRef}
    >
      <div className="file-display-header">
        <div className="path-navigator">
          {renderBreadcrumbs()}
        </div>
        
        {/* 도구 모음 추가 */}
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
        
        <div className="file-actions">
          <button 
            className="new-folder-btn" 
            onClick={handleNewFolderClick}
            disabled={isLoading || isLocalLoading}
          >
            새 폴더
          </button>
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={isLoading || isLocalLoading}
          >
            새로고침
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
              isSelected={selectedItems.includes(file.id)}
            />
          ))
        ) : (
          <div className="empty-message">
            <p>이 폴더에 파일이 없습니다</p>
            <p className="drop-message">
              여기에 파일이나 폴더를 끌어서 놓거나 업로드 버튼을 사용하세요
            </p>
          </div>
        )}
      </div>

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-message">
            <p>파일 또는 폴더를 여기에 놓아 업로드</p>
          </div>
        </div>
      )}
      
      {/* 새 폴더 생성 모달 */}
      {showNewFolderModal && (
        <div className="folder-modal-overlay" onClick={handleModalOutsideClick}>
          <div className="folder-modal">
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
          <div className="folder-modal">
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
          <div className="folder-modal">
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
          <div className="context-menu-item" onClick={handleRefresh}>
            새로고침
          </div>
        </div>
      )}

      {/* 알림 */}
      {notification.visible && (
        <div className="notification">
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default FileDisplay;