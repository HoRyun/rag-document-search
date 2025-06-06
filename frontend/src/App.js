import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Header from "./components/Header/Header";
import Sidebar from "./components/Sidebar/Sidebar";
import FileDisplay from "./components/FileDisplay/FileDisplay";
import Chatbot from "./components/Chatbot/Chatbot";
import LoginForm from "./components/Login/LoginForm";
import RegisterForm from "./components/Login/RegisterForm";
import "./App.css";
import "./Theme.css";

// API 기본 URL 설정
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://rag-alb-547296323.ap-northeast-2.elb.amazonaws.com/fast_api";

function App() {
  const [files, setFiles] = useState([]);
  const [directories, setDirectories] = useState([
    { id: "home", name: "Home", path: "/" },
  ]);
  const [currentPath, setCurrentPath] = useState("/");
  const [chatbotOpen, setChatbotOpen] = useState(false);

  const [selectedItems, setSelectedItems] = useState([]);

  // 인증 관련 상태
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [user, setUser] = useState(null);

  // RAG 관련 상태
  const [isQuerying, setIsQuerying] = useState(false);

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);

  // 테마 상태 (다크 모드)
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // 사이드바 표시 상태 (모바일용)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 다운로드 관련
  const [downloadState, setDownloadState] = useState({
    isActive: false,
    progress: 0,
    fileName: '',
    error: null,
    abortController: null
  });

  const [notification, setNotification] = useState({ visible: false, message: '' });

  // 컴포넌트 마운트 시 로그인 상태 확인 및 테마 설정 불러오기
  useEffect(() => {
    // 토큰이 있으면 사용자 정보 가져오기
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserInfo(token);
    }
    
    // 저장된 테마 설정 불러오기
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const handleSelectedItemsChange = (newSelectedItems) => {
    setSelectedItems(newSelectedItems);
    console.log('App.js에서 선택된 아이템 업데이트:', newSelectedItems);
  };

  const handleDownloadItems = async (selectedFileIds) => {
    if (!selectedFileIds || selectedFileIds.length === 0) {
      console.warn('다운로드할 파일이 선택되지 않았습니다.');
      return;
    }

    // 큰 파일 다운로드 전 확인
    const selectedFiles = files.filter(file => selectedFileIds.includes(file.id));
    const totalSize = selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    
    if (totalSize > 100 * 1024 * 1024) { // 100MB 이상
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };
      
      const confirm = window.confirm(
        `선택한 파일의 총 크기가 ${formatBytes(totalSize)}입니다. 다운로드하시겠습니까?`
      );
      if (!confirm) return;
    }

    try {
      setDownloadState(prev => ({ ...prev, isActive: true, error: null }));
      const token = localStorage.getItem("token");

      // 선택된 파일 정보 가져오기
      const selectedFiles = files.filter(file => selectedFileIds.includes(file.id));
      
      console.log('===== 다운로드 시작 =====');
      console.log('선택된 파일들:', selectedFiles);
      console.log('파일 개수:', selectedFiles.length);

      // 단일 파일과 다중 파일 처리 분기
      if (selectedFiles.length === 1) {
        await downloadSingleFile(selectedFiles[0], token);
      } else {
        await downloadMultipleFiles(selectedFiles, token);
      }

      console.log('===== 다운로드 완료 =====');
      
    } catch (error) {
      console.error("다운로드 중 오류 발생:", error);
      
      // 에러 타입에 따른 사용자 알림
      if (error.message.includes('취소')) {
        showNotification('다운로드가 취소되었습니다.');
      } else if (error.message.includes('네트워크')) {
        showNotification('네트워크 오류로 다운로드에 실패했습니다. 인터넷 연결을 확인해주세요.');
      } else if (error.message.includes('권한')) {
        showNotification('파일 다운로드 권한이 없습니다.');
      } else if (error.message.includes('404')) {
        showNotification('파일을 찾을 수 없습니다.');
      } else {
        showNotification('다운로드 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setDownloadState(prev => ({ ...prev, isActive: false }));
    }
  };

  useEffect(() => { //****
    return () => {
      if (downloadState.abortController) {
        downloadState.abortController.abort();
      }
    };
  }, [downloadState.abortController]);

  const downloadSingleFile = async (file, token) => {
    console.log(`단일 파일 다운로드 시작: ${file.name}`);
    
    // AbortController 생성
    const abortController = new AbortController();
    setDownloadState(prev => ({ ...prev, abortController }));
    
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${file.id}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: abortController.signal // AbortController 신호 추가
      });

      if (!response.ok) {
        const errorMessage = response.status === 404 
          ? '파일을 찾을 수 없습니다.' 
          : response.status === 403 
          ? '파일 다운로드 권한이 없습니다.'
          : `다운로드 실패 (${response.status})`;
        throw new Error(errorMessage);
      }

      // Content-Length 헤더에서 파일 크기 가져오기
      const contentLength = response.headers.get('Content-Length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      
      console.log('파일 크기:', totalSize, 'bytes');
      
      // Response body를 ReadableStream으로 읽기
      const reader = response.body.getReader();
      const chunks = [];
      let receivedSize = 0;
      
      // 진행률 추적을 위한 시간 변수
      let startTime = Date.now();
      let lastUpdateTime = startTime;
      
      while (true) {
        // 취소 신호 확인
        if (abortController.signal.aborted) {
          reader.cancel();
          throw new Error('다운로드가 사용자에 의해 취소되었습니다.');
        }
        
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedSize += value.length;
        
        const currentTime = Date.now();
        
        // 100ms마다 진행률 업데이트 (너무 자주 업데이트하면 성능 저하)
        if (currentTime - lastUpdateTime >= 100) {
          const progress = totalSize > 0 ? Math.round((receivedSize / totalSize) * 100) : 0;
          const elapsedTime = (currentTime - startTime) / 1000; // 초 단위
          const speed = receivedSize / elapsedTime; // bytes/sec
          
          // FileDisplay로 진행률 정보 전달
          setDownloadState(prev => ({
            ...prev,
            progress,
            fileName: file.name,
            receivedSize,
            totalSize,
            speed,
            elapsedTime
          }));
          
          lastUpdateTime = currentTime;
          
          console.log(`진행률: ${progress}%, 속도: ${formatBytes(speed)}/s`);
        }
      }
      
      // 다운로드 완료 - Blob 생성 및 파일 저장
      const blob = new Blob(chunks, { 
        type: response.headers.get('Content-Type') || 'application/octet-stream' 
      });
      
      // 파일 다운로드 실행
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`파일 다운로드 완료: ${file.name}`);
      showNotification(`"${file.name}" 다운로드가 완료되었습니다.`);
      
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('취소')) {
        console.log(`파일 다운로드 취소됨: ${file.name}`);
        throw new Error('다운로드가 취소되었습니다.');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('네트워크 연결을 확인해주세요.');
      } else {
        console.error(`파일 다운로드 오류 (${file.name}):`, error);
        throw error;
      }
    } finally {
      setDownloadState(prev => ({ ...prev, abortController: null }));
    }
  };

  const downloadMultipleFiles = async (files, token) => {
    console.log(`다중 파일 ZIP 다운로드 시작: ${files.length}개 파일`);
    
    // AbortController 생성
    const abortController = new AbortController();
    setDownloadState(prev => ({ ...prev, abortController }));
    
    try {
      // 서버에 ZIP 생성 요청
      const response = await fetch(`${API_BASE_URL}/documents/download-zip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: files.map(f => f.id),
          zipName: `selected_files_${new Date().getTime()}.zip`
        }),
        signal: abortController.signal // AbortController 신호 추가
      });

      if (!response.ok) {
        throw new Error(`ZIP 다운로드 실패: ${response.status} ${response.statusText}`);
      }

      // Content-Length 헤더에서 ZIP 파일 크기 가져오기
      const contentLength = response.headers.get('Content-Length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      
      console.log('ZIP 파일 크기:', totalSize, 'bytes');
      
      // Response body를 ReadableStream으로 읽기
      const reader = response.body.getReader();
      const chunks = [];
      let receivedSize = 0;
      
      // 진행률 추적을 위한 시간 변수
      let startTime = Date.now();
      let lastUpdateTime = startTime;
      
      while (true) {
        // 취소 신호 확인
        if (abortController.signal.aborted) {
          reader.cancel();
          throw new Error('ZIP 다운로드가 사용자에 의해 취소되었습니다.');
        }
        
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedSize += value.length;
        
        const currentTime = Date.now();
        
        // 100ms마다 진행률 업데이트
        if (currentTime - lastUpdateTime >= 100) {
          const progress = totalSize > 0 ? Math.round((receivedSize / totalSize) * 100) : 0;
          const elapsedTime = (currentTime - startTime) / 1000; // 초 단위
          const speed = receivedSize / elapsedTime; // bytes/sec
          
          // FileDisplay로 진행률 정보 전달
          setDownloadState(prev => ({
            ...prev,
            progress,
            fileName: `${files.length}개 파일`,
            receivedSize,
            totalSize,
            speed,
            elapsedTime,
            isZip: true
          }));
                    
          lastUpdateTime = currentTime;
          
          console.log(`ZIP 진행률: ${progress}%, 속도: ${formatBytes(speed)}/s`);
        }
      }
      
      // ZIP 다운로드 완료 - Blob 생성 및 파일 저장
      const blob = new Blob(chunks, { type: 'application/zip' });
      
      // 파일 다운로드 실행
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_files_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`ZIP 다운로드 완료: ${files.length}개 파일`);
      showNotification(`${files.length}개 파일이 ZIP으로 다운로드되었습니다.`);
      
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('취소')) {
        console.log(`ZIP 다운로드 취소됨: ${files.length}개 파일`);
        throw new Error('ZIP 다운로드가 취소되었습니다.');
      } else {
        console.error('ZIP 다운로드 오류:', error);
        throw error;
      }
    } finally {
      // AbortController 정리
      setDownloadState(prev => ({ ...prev, abortController: null }));
    }
  };

  const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // 남은 시간 계산 유틸리티 함수
  const formatRemainingTime = (speed, remainingBytes) => {
    if (speed === 0) return '계산 중...';
    
    const remainingSeconds = remainingBytes / speed;
    
    if (remainingSeconds < 60) {
      return `${Math.round(remainingSeconds)}초`;
    } else if (remainingSeconds < 3600) {
      return `${Math.round(remainingSeconds / 60)}분`;
    } else {
      return `${Math.round(remainingSeconds / 3600)}시간`;
    }
  };

  // 테마 토글 핸들러
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    // 문서 루트에 테마 속성 설정
    document.documentElement.setAttribute(
      "data-theme", 
      newTheme ? "dark" : "light"
    );
    
    // 테마 설정 저장
    localStorage.setItem("theme", newTheme ? "dark" : "light");
  };

  // 사이드바 토글 핸들러
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // 사이드바 닫기 핸들러
  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const showNotification = (message) => {
    setNotification({ visible: true, message });
    setTimeout(() => {
      setNotification({ visible: false, message: '' });
    }, 3000);
  };

  // 컴포넌트 마운트 시 로그인 상태 확인
  useEffect(() => {
    // 토큰이 있으면 사용자 정보 가져오기
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserInfo(token);
    }
  }, []);

  // 사용자 정보 가져오기
  const fetchUserInfo = async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Error fetching user info:", error);
      localStorage.removeItem("token");
    }
  };

  // 디렉토리 구조 가져오기
  const fetchDirectories = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      // 백엔드에서 디렉토리 구조 가져오기
      const response = await axios.get(`${API_BASE_URL}/documents/structure`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data && response.data.directories) {
        // 루트 디렉토리가 있는지 확인
        const directories = response.data.directories;
        const hasRootDir = directories.some((dir) => dir.path === "/");

        // 이름 순으로 정렬
        directories.sort((a, b) => {
          // 루트 디렉토리는 항상 첫 번째
          if (a.path === "/") return -1;
          if (b.path === "/") return 1;

          return a.name.localeCompare(b.name, "ko");
        });

        // 루트 디렉토리가 없으면 추가
        if (!hasRootDir) {
          const updatedDirectories = [
            { id: "home", name: "Home", path: "/" },
            ...directories,
          ];
          setDirectories(updatedDirectories);
        } else {
          setDirectories(directories);
        }

        console.log("디렉토리 구조 가져옴:", directories);
      } else {
        // 기본 홈 디렉토리 설정
        setDirectories([{ id: "home", name: "Home", path: "/" }]);
      }
    } catch (error) {
      console.error("Error fetching directories:", error);
      // 기본 홈 디렉토리만 제공하고 나머지는 비움
      setDirectories([{ id: "home", name: "Home", path: "/" }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 문서 목록 가져오기
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // 루트 경로를 처리하기 위한 분기
      let pathParam = currentPath;

      // 루트 경로('/')일 경우, 백엔드 API가 빈 문자열을 예상할 수 있으므로 처리
      if (currentPath === "/") {
        pathParam = "";
        console.log("루트 경로 문서 요청 (빈 문자열로 변환):", pathParam);

        // 루트 경로인 경우 API 요청 대신 직계 하위 폴더를, 디렉토리 정보에서 찾아 표시
        // API가 루트 경로에서 제대로 작동하지 않을 때 사용하는 대안
        if (directories && directories.length > 0) {
          // 루트 경로의 직계 자식 폴더 찾기 (경로가 /로 시작하고 슬래시가 1개만 있는 경로)
          const rootSubfolders = directories
            .filter((dir) => {
              if (dir.path === "/") return false; // 루트 자체는 제외
              const parts = dir.path.split("/").filter(Boolean);
              return parts.length === 1; // 첫 번째 레벨의 폴더만 선택
            })
            .map((dir) => ({
              id: dir.id,
              name: dir.name,
              path: dir.path,
              isDirectory: true,
              type: "folder",
              // 추가적인 속성이 필요하면 여기에 추가
            }));

          console.log(
            `루트 경로에서 ${rootSubfolders.length}개 폴더 찾음:`,
            rootSubfolders
          );

          // API 호출 없이 찾은 폴더들을 files 상태로 설정
          if (rootSubfolders.length > 0) {
            setFiles(rootSubfolders);
            setIsLoading(false);
            return; // API 호출 생략
          }
        }
      }

      console.log(`문서 요청 경로: ${pathParam}`);

      const response = await axios.get(`${API_BASE_URL}/documents`, {
        params: { path: pathParam },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 백엔드에서 받은 항목을 files 상태로 변환
      if (response.data && response.data.items) {
        console.log(
          `경로 '${currentPath}'에서 ${response.data.items.length}개 항목 받음:`,
          response.data.items
        );

        // 항목을 종류(폴더, 파일)와 이름 기준으로 정렬
        const sortedFiles = [...response.data.items].sort((a, b) => {
          // 폴더를 파일보다 위에 표시
          if (
            (a.isDirectory || a.type === "folder") &&
            !(b.isDirectory || b.type === "folder")
          ) {
            return -1;
          }
          if (
            !(a.isDirectory || a.type === "folder") &&
            (b.isDirectory || b.type === "folder")
          ) {
            return 1;
          }
          // 같은 종류면 이름 기준으로 정렬
          return a.name.localeCompare(b.name, "ko");
        });

        setFiles(sortedFiles);
      } else {
        console.log(`경로 '${currentPath}'에서 항목 없음`);

        // API 응답이 없고 루트 경로일 때 대체 로직
        if (currentPath === "/" && directories && directories.length > 0) {
          // 위에서 작성한 로직과 동일: 디렉토리 구조에서 루트 하위 폴더 추출
          const rootSubfolders = directories
            .filter((dir) => {
              if (dir.path === "/") return false; // 루트 자체는 제외
              const parts = dir.path.split("/").filter(Boolean);
              return parts.length === 1; // 첫 번째 레벨의 폴더만 선택
            })
            .map((dir) => ({
              id: dir.id,
              name: dir.name,
              path: dir.path,
              isDirectory: true,
              type: "folder",
            }));

          console.log(
            `API 응답 없음, 폴더 구조에서 ${rootSubfolders.length}개 폴더 찾음:`,
            rootSubfolders
          );

          if (rootSubfolders.length > 0) {
            setFiles(rootSubfolders);
          } else {
            setFiles([]);
          }
        } else {
          setFiles([]);
        }
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      console.log("오류 발생:", error.message);

      // 오류 발생 시 루트 경로일 때 대체 로직
      if (currentPath === "/" && directories && directories.length > 0) {
        const rootSubfolders = directories
          .filter((dir) => {
            if (dir.path === "/") return false;
            const parts = dir.path.split("/").filter(Boolean);
            return parts.length === 1;
          })
          .map((dir) => ({
            id: dir.id,
            name: dir.name,
            path: dir.path,
            isDirectory: true,
            type: "folder",
          }));

        console.log(
          `API 오류 발생, 폴더 구조에서 ${rootSubfolders.length}개 폴더 찾음`
        );

        if (rootSubfolders.length > 0) {
          setFiles(rootSubfolders);
        } else {
          setFiles([]);
        }
      } else {
        // 빈 파일 목록으로 설정
        setFiles([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, directories]);

  // 인증 시 디렉토리 및 문서 목록 가져오기
  useEffect(() => {
    if (isAuthenticated) {
      fetchDirectories();
    }
  }, [isAuthenticated, fetchDirectories]);

  // 현재 경로가 변경될 때 해당 경로의 문서 가져오기
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated, currentPath, fetchDocuments]);

  // 파일 업로드 처리
  const handleAddFile = async (
    fileList,
    targetPath = currentPath,
    dirStructure = null
  ) => {
    if (!fileList || fileList.length === 0) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // 디버깅: 업로드되는 파일과 경로 정보 출력
      console.log("===== 업로드 디버깅 정보 =====");
      console.log("업로드 경로:", targetPath);
      console.log("파일 리스트:", fileList);
      console.log("전달받은 디렉토리 구조:", dirStructure);

      // dirStructure가 null이면 기본 구조 생성
      if (!dirStructure) {
        dirStructure = createDirectoryStructureForPath(targetPath);
        console.log("생성된 기본 디렉토리 구조:", dirStructure);
      }

      // FormData 생성
      const formData = new FormData();

      // 파일 추가 및 경로 정보 수집
      const filePaths = [];
      for (let i = 0; i < fileList.length; i++) {
        // 디버깅: 각 파일 정보 출력
        console.log(`파일 ${i + 1}:`, {
          name: fileList[i].name,
          size: fileList[i].size,
          type: fileList[i].type,
          relativePath:
            fileList[i].relativePath ||
            fileList[i].webkitRelativePath ||
            "없음",
        });

        // 파일 경로 정보가 있는 경우 처리
        if (fileList[i].relativePath || fileList[i].webkitRelativePath) {
          const fullPath =
            fileList[i].relativePath || fileList[i].webkitRelativePath;
          filePaths.push(fullPath);
          // 파일 경로 정보를 추가 필드로 전송
          formData.append("file_paths", fullPath);
        }

        formData.append("files", fileList[i]);
      }

      // 경로 정보 추가 (루트 경로인 경우 빈 문자열로 처리)
      const apiPath = targetPath === "/" ? "" : targetPath;
      formData.append("path", apiPath);

      // 디렉토리 구조 추가 (항상 전송)
      formData.append("directory_structure", JSON.stringify(dirStructure));

      // 디버깅: 디렉토리 구조 상세 출력
      console.log(
        "전송할 디렉토리 구조 상세:",
        JSON.stringify(dirStructure, null, 2)
      );

      // FormData 내용 확인
      console.log("FormData 항목:");
      for (let pair of formData.entries()) {
        // 파일 객체는 너무 큰 정보이므로 파일명만 출력
        if (pair[1] instanceof File) {
          console.log(pair[0], "(파일):", pair[1].name);
        } else {
          console.log(pair[0], ":", pair[1]);
        }
      }

      // 디버깅: API 요청 정보
      console.log("API 요청 URL:", `${API_BASE_URL}/documents/manage`);
      console.log("헤더 정보:", {
        Authorization: "Bearer " + token.substring(0, 10) + "...",
        "Content-Type": "multipart/form-data",
      });

      // API 호출
      const response = await axios.post(
        `${API_BASE_URL}/documents/manage`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // 디버깅: API 응답 확인
      console.log("API 응답:", response.data);
      console.log("===== 업로드 디버깅 정보 종료 =====");

      // 업로드 성공 후 문서 목록 새로고침
      fetchDocuments();
      // 디렉토리 구조도 새로고침
      fetchDirectories();
    } catch (error) {
      console.error("Error uploading files:", error);

      // 디버깅: 오류 상세 정보
      console.log("===== 업로드 오류 정보 =====");
      if (error.response) {
        // 서버가 응답을 반환한 경우
        console.log("서버 응답 상태:", error.response.status);
        console.log("서버 응답 데이터:", error.response.data);
        console.log("서버 응답 헤더:", error.response.headers);
      } else if (error.request) {
        // 요청이 전송되었으나 응답이 없는 경우
        console.log("요청 정보 (응답 없음):", error.request);
      } else {
        // 요청 설정 중에 오류가 발생한 경우
        console.log("오류 메시지:", error.message);
      }
      console.log("오류 설정:", error.config);
      console.log("===== 업로드 오류 정보 종료 =====");

      alert("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 경로에 따른 디렉토리 구조 생성 함수
  const createDirectoryStructureForPath = (path) => {
    // 루트 경로인 경우 빈 객체 반환
    if (path === "/") {
      return {};
    }

    // 경로를 폴더 이름으로 분리
    const pathParts = path.split("/").filter(Boolean);

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

  // 새 폴더 생성 처리
  const handleCreateFolder = async (folderName) => {
    if (!folderName.trim()) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // 폴더 생성 작업 정의
      const operations = [
        {
          operation_type: "create",
          name: folderName,
          path: currentPath === "/" ? "" : currentPath,
        },
      ];

      // FormData 생성
      const formData = new FormData();
      formData.append("operations", JSON.stringify(operations));

      // API 호출
      await axios.post(`${API_BASE_URL}/documents/manage`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 성공 시 문서 목록 새로고침
      fetchDocuments();
      // 디렉토리 구조도 새로고침
      fetchDirectories();
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("폴더 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 일반화된 파일 작업 함수 - 이동 및 복사에 사용
  const handleItemOperation = async (itemId, targetPath, operationType = "move") => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // 디버깅 정보 로깅
      console.log(`===== 파일/폴더 ${operationType} 디버깅 정보 =====`);
      console.log(`항목 ID: ${itemId}`);
      console.log(`대상 경로: ${targetPath}`);
      console.log(`작업 유형: ${operationType}`);

      // 작업 정의
      const operations = [
        {
          operation_type: operationType, // "move" 또는 "copy"
          item_id: itemId,
          target_path: targetPath === "/" ? "" : targetPath,
        },
      ];

      // FormData 생성
      const formData = new FormData();
      formData.append("operations", JSON.stringify(operations));

      console.log("API 요청 URL:", `${API_BASE_URL}/documents/manage`);
      console.log("요청 데이터:", JSON.stringify(operations));

      // API 호출
      const response = await axios.post(
        `${API_BASE_URL}/documents/manage`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(`API 응답:`, response.data);
      console.log(`===== 파일/폴더 ${operationType} 디버깅 정보 종료 =====`);

      // 성공 시 문서 목록 새로고침
      fetchDocuments();
      // 디렉토리 구조도 새로고침
      fetchDirectories();
      
      return response.data;
    } catch (error) {
      console.error(`Error ${operationType} item:`, error);
      
      // 오류 상세 정보 로깅
      console.log(`===== 파일/폴더 ${operationType} 오류 정보 =====`);
      if (error.response) {
        console.log(`서버 응답 상태: ${error.response.status}`);
        console.log(`서버 응답 데이터:`, error.response.data);
      } else if (error.request) {
        console.log(`요청 정보 (응답 없음):`, error.request);
      } else {
        console.log(`오류 메시지: ${error.message}`);
      }
      console.log(`오류 설정:`, error.config);
      console.log(`===== 파일/폴더 ${operationType} 오류 정보 종료 =====`);
      
      alert(`항목 ${operationType === "move" ? "이동" : "복사"} 중 오류가 발생했습니다.`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 파일/폴더 이동 처리 - 일반화된 함수 사용
  const handleMoveItem = async (itemId, newPath) => {
    return handleItemOperation(itemId, newPath, "move");
  };

  // 파일/폴더 복사 처리 - 일반화된 함수 사용
  const handleCopyItem = async (itemId, newPath) => {
    return handleItemOperation(itemId, newPath, "copy");
  };

  // 파일/폴더 이름 변경 처리 개선
  const handleRenameItem = async (itemId, newName) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // 디버깅 정보 로깅
      console.log(`===== 파일/폴더 이름 변경 디버깅 정보 =====`);
      console.log(`항목 ID: ${itemId}`);
      console.log(`새 이름: ${newName}`);

      // 이름 변경 작업 정의
      const operations = [
        {
          operation_type: "rename",
          item_id: itemId,
          name: newName,
        },
      ];

      // FormData 생성
      const formData = new FormData();
      formData.append("operations", JSON.stringify(operations));

      console.log("API 요청 URL:", `${API_BASE_URL}/documents/manage`);
      console.log("요청 데이터:", JSON.stringify(operations));

      // API 호출
      const response = await axios.post(
        `${API_BASE_URL}/documents/manage`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(`API 응답:`, response.data);
      console.log(`===== 파일/폴더 이름 변경 디버깅 정보 종료 =====`);

      // 성공 시 문서 목록 새로고침
      fetchDocuments();
      // 디렉토리 구조도 새로고침
      fetchDirectories();
      
      return response.data;
    } catch (error) {
      console.error("Error renaming item:", error);
      
      // 오류 상세 정보 로깅
      console.log(`===== 파일/폴더 이름 변경 오류 정보 =====`);
      if (error.response) {
        console.log(`서버 응답 상태: ${error.response.status}`);
        console.log(`서버 응답 데이터:`, error.response.data);
      } else if (error.request) {
        console.log(`요청 정보 (응답 없음):`, error.request);
      } else {
        console.log(`오류 메시지: ${error.message}`);
      }
      console.log(`오류 설정:`, error.config);
      console.log(`===== 파일/폴더 이름 변경 오류 정보 종료 =====`);
      
      alert("이름 변경 중 오류가 발생했습니다.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 파일/폴더 삭제 처리 개선
  const handleDeleteItem = async (itemId) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // 디버깅 정보 로깅
      console.log(`===== 파일/폴더 삭제 디버깅 정보 =====`);
      console.log(`항목 ID: ${itemId}`);

      // 삭제 작업 정의
      const operations = [
        {
          operation_type: "delete",
          item_id: itemId,
        },
      ];

      // FormData 생성
      const formData = new FormData();
      formData.append("operations", JSON.stringify(operations));

      console.log("API 요청 URL:", `${API_BASE_URL}/documents/manage`);
      console.log("요청 데이터:", JSON.stringify(operations));

      // API 호출
      const response = await axios.post(
        `${API_BASE_URL}/documents/manage`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(`API 응답:`, response.data);
      console.log(`===== 파일/폴더 삭제 디버깅 정보 종료 =====`);

      // 성공 시 문서 목록 새로고침
      fetchDocuments();
      // 디렉토리 구조도 새로고침
      fetchDirectories();
      
      return response.data;
    } catch (error) {
      console.error("Error deleting item:", error);
      
      // 오류 상세 정보 로깅
      console.log(`===== 파일/폴더 삭제 오류 정보 =====`);
      if (error.response) {
        console.log(`서버 응답 상태: ${error.response.status}`);
        console.log(`서버 응답 데이터:`, error.response.data);
      } else if (error.request) {
        console.log(`요청 정보 (응답 없음):`, error.request);
      } else {
        console.log(`오류 메시지: ${error.message}`);
      }
      console.log(`오류 설정:`, error.config);
      console.log(`===== 파일/폴더 삭제 오류 정보 종료 =====`);
      
      alert("항목 삭제 중 오류가 발생했습니다.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 폴더를 더블클릭하여 해당 폴더로 이동
  const handleFolderOpen = (folderPath) => {
    console.log(`폴더 열기: ${folderPath}`);
    setCurrentPath(folderPath);
    // 모바일에서 폴더 이동 시 사이드바 닫기
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  // 질문 처리
  const handleQuery = async (queryText) => {
    if (!queryText.trim()) return;

    setIsQuerying(true);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("query", queryText);

      const response = await axios.post(
        `${API_BASE_URL}/documents/query`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const answer = response.data.answer;

      // 챗봇에 표시할 응답 반환
      return answer;
    } catch (error) {
      console.error("Error querying:", error);
      return "문서 검색 중 오류가 발생했습니다.";
    } finally {
      setIsQuerying(false);
    }
  };

  // 로그인 성공 핸들러
  const handleLoginSuccess = () => {
    const token = localStorage.getItem("token");
    fetchUserInfo(token);
  };

  // 회원가입 화면 전환
  const handleShowRegister = () => {
    setShowRegister(true);
  };

  // 로그인 화면 전환
  const handleShowLogin = () => {
    setShowRegister(false);
  };

  // 회원가입 성공 핸들러
  const handleRegisterSuccess = () => {
    setShowRegister(false);
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUser(null);
  };

  // 챗봇 토글
  const toggleChatbot = () => {
    setChatbotOpen(!chatbotOpen);
  };

  // 로그인 상태에 따라 화면 렌더링
  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        {showRegister ? (
          <RegisterForm
            onRegisterSuccess={handleRegisterSuccess}
            onShowLogin={handleShowLogin}
          />
        ) : (
          <LoginForm
            onLoginSuccess={handleLoginSuccess}
            onShowRegister={handleShowRegister}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <Header onLogout={handleLogout} username={user?.username} isDarkMode={isDarkMode} toggleTheme={toggleTheme}/>
      
      <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
        ☰
      </button>
      
      {sidebarOpen && <div className="sidebar-overlay active" onClick={closeSidebar}></div>}
      
      <div className="main-container">
        <Sidebar
          className={sidebarOpen ? 'active' : ''}
          directories={directories}
          currentPath={currentPath}
          setCurrentPath={setCurrentPath}
          onRefresh={fetchDirectories}
          closeSidebar={closeSidebar}
        />
        
        <FileDisplay
          files={files}
          directories={directories}
          currentPath={currentPath}
          onAddFile={handleAddFile}
          onCreateFolder={handleCreateFolder}
          onMoveItem={handleMoveItem}
          onCopyItem={handleCopyItem}
          onDeleteItem={handleDeleteItem}
          onRenameItem={handleRenameItem}
          onFolderOpen={handleFolderOpen}
          onRefresh={fetchDocuments}
          isLoading={isLoading}
          selectedItems={selectedItems}
          onSelectedItemsChange={handleSelectedItemsChange}
          onDownloadItems={handleDownloadItems}
          downloadState={downloadState}
          onDownloadCancel={() => {
            if (downloadState.abortController) {
              downloadState.abortController.abort();
            }
          }}
        />
      </div>
      
      <Chatbot
        isOpen={chatbotOpen}
        toggleChatbot={toggleChatbot}
        onQuery={handleQuery}
        isQuerying={isQuerying}
        files={files}
        directories={directories}
        selectedItems={selectedItems} // ← 실제 상태 전달
        currentPath={currentPath}
        onRefreshFiles={fetchDocuments}
        onShowNotification={showNotification}
      />

      {notification.visible && (
        <div className="notification">
          {notification.message}
        </div>
      )}
    </div>
  );
}

export default App;