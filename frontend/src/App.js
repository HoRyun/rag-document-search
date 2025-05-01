import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Header from "./components/Header/Header";
import Sidebar from "./components/Sidebar/Sidebar";
import FileDisplay from "./components/FileDisplay/FileDisplay";
import Chatbot from "./components/Chatbot/Chatbot";
import LoginForm from "./components/Login/LoginForm";
import RegisterForm from "./components/Login/RegisterForm";
import "./App.css";
import "./Theme.css"; // 테마 CSS 추가

// API 기본 URL 설정
// const API_BASE_URL = "http://43.200.3.86:8000/fast_api";
const API_BASE_URL = "http://localhost:8000/fast_api";

function App() {
  const [files, setFiles] = useState([]);
  const [directories, setDirectories] = useState([
    { id: "home", name: "Home", path: "/" },
  ]);
  const [currentPath, setCurrentPath] = useState("/");
  const [chatbotOpen, setChatbotOpen] = useState(false);

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

  // 파일/폴더 이동 처리 개선
  const handleMoveItem = async (itemId, newPath) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      // 디버깅 정보 로깅
      console.log(`===== 파일/폴더 이동 디버깅 정보 =====`);
      console.log(`항목 ID: ${itemId}`);
      console.log(`새 경로: ${newPath}`);

      // 이동 작업 정의
      const operations = [
        {
          operation_type: "move",
          item_id: itemId,
          new_path: newPath === "/" ? "" : newPath,
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
      console.log(`===== 파일/폴더 이동 디버깅 정보 종료 =====`);

      // 성공 시 문서 목록 새로고침
      fetchDocuments();
      // 디렉토리 구조도 새로고침
      fetchDirectories();
      
      return response.data;
    } catch (error) {
      console.error("Error moving item:", error);
      
      // 오류 상세 정보 로깅
      console.log(`===== 파일/폴더 이동 오류 정보 =====`);
      if (error.response) {
        console.log(`서버 응답 상태: ${error.response.status}`);
        console.log(`서버 응답 데이터:`, error.response.data);
      } else if (error.request) {
        console.log(`요청 정보 (응답 없음):`, error.request);
      } else {
        console.log(`오류 메시지: ${error.message}`);
      }
      console.log(`오류 설정:`, error.config);
      console.log(`===== 파일/폴더 이동 오류 정보 종료 =====`);
      
      alert("항목 이동 중 오류가 발생했습니다.");
      throw error;
    } finally {
      setIsLoading(false);
    }
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
      <div className="main-container">
        <Sidebar
          directories={directories}
          currentPath={currentPath}
          setCurrentPath={setCurrentPath}
          onRefresh={fetchDirectories}
        />
        <FileDisplay
          files={files}
          directories={directories}
          currentPath={currentPath}
          onAddFile={handleAddFile}
          onCreateFolder={handleCreateFolder}
          onMoveItem={handleMoveItem}
          onDeleteItem={handleDeleteItem}
          onRenameItem={handleRenameItem}
          onFolderOpen={handleFolderOpen}
          onRefresh={fetchDocuments}
          isLoading={isLoading}
        />
      </div>
      <Chatbot
        isOpen={chatbotOpen}
        toggleChatbot={toggleChatbot}
        onQuery={handleQuery}
        isQuerying={isQuerying}
      />
    </div>
  );
}

export default App;