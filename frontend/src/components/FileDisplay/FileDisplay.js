import React, { useState, useRef } from "react";
import FileItem from "../FileItem/FileItem";
import "./FileDisplay.css";

const FileDisplay = ({ files, currentPath, onAddFile, onCreateFolder, onFolderOpen, onRefresh, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showUploadTypeMenu, setShowUploadTypeMenu] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const newFolderInputRef = useRef(null);
  const uploadButtonRef = useRef(null);

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
  const handleDocumentClick = React.useCallback((e) => {
    if (
      showUploadTypeMenu && 
      uploadButtonRef.current && 
      !uploadButtonRef.current.contains(e.target)
    ) {
      setShowUploadTypeMenu(false);
    }
  }, [showUploadTypeMenu]);

  // useEffect에 의존성 배열 추가
  React.useEffect(() => {
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

  // Handle file or folder click
  const handleItemClick = (file) => {
    if (file.isDirectory || file.type === 'folder') {
      // 현재 경로에 폴더명을 추가
      const newPath = currentPath === "/" 
        ? `/${file.name}` 
        : `${currentPath}/${file.name}`;
      
      onFolderOpen(newPath);
    }
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
      className={`file-display ${isDragging ? "dragging" : ""} ${isLoading ? "loading" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="file-display-header">
        <div className="path-navigator">
          {renderBreadcrumbs()}
        </div>
        <div className="file-actions">
          <button 
            className="new-folder-btn" 
            onClick={handleNewFolderClick}
            disabled={isLoading}
          >
            새 폴더
          </button>
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            새로고침
          </button>
          <div className="upload-dropdown" ref={uploadButtonRef}>
            <button
              className="upload-btn"
              onClick={handleUploadButtonClick}
              disabled={isUploading || isLoading}
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
        {isLoading ? (
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
              onDoubleClick={() => handleItemClick(file)}
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
    </div>
  );
};

export default FileDisplay;