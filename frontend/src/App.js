import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Header from "./components/Header/Header";
import Sidebar from "./components/Sidebar/Sidebar";
import FileDisplay from "./components/FileDisplay/FileDisplay";
import Chatbot from "./components/Chatbot/Chatbot";
import LoginForm from "./components/Login/LoginForm";
import RegisterForm from "./components/Login/RegisterForm";
import "./App.css";

// API 기본 URL 설정
const API_BASE_URL = "http://localhost:8000/fast_api";

function App() {
  const [files, setFiles] = useState([]);
  const [directories, setDirectories] = useState([{ id: "home", name: "Home", path: "/" }]);
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

  // 디렉토리 구조 백엔드로 전송 (document API로 통합)
  const syncDirectoryStructure = async (dirStructure) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/documents/sync-directories`,
        { directories: dirStructure },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("Directory structure synced with backend");
    } catch (error) {
      console.error("Error syncing directory structure:", error);
    }
  };

  // 디렉토리 구조 가져오기 (document API로 통합)
  const fetchDirectories = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      // 백엔드에서 디렉토리 구조 가져오기
      const response = await axios.get(`${API_BASE_URL}/documents/directories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data && response.data.directories) {
        setDirectories(response.data.directories);
      } else {
        // 기본 홈 디렉토리 설정
        setDirectories([
          { id: "home", name: "Home", path: "/" }
        ]);
      }
    } catch (error) {
      console.error("Error fetching directories:", error);
      // 기본 홈 디렉토리만 제공하고 나머지는 비움
      setDirectories([
        { id: "home", name: "Home", path: "/" }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 문서 목록 가져오기
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/documents`, {
        params: { path: currentPath },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 백엔드에서 받은 문서를 files 상태로 변환
      const fetchedFiles = (response.data.documents || []).map((doc) => ({
        id: doc.id || Math.random().toString(36).substr(2, 9),
        name: doc.filename,
        type: getFileType(doc.filename),
        path: currentPath,
        isDirectory: doc.is_directory || false,
        uploaded_at: doc.uploaded_at,
      }));

      setFiles(fetchedFiles);
    } catch (error) {
      console.error("Error fetching documents:", error);
      // 빈 파일 목록으로 설정
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPath]);

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

  // 파일 타입 유추
  const getFileType = (filename) => {
    if (!filename) return "blank";
    
    const ext = filename.split(".").pop().toLowerCase();
    if (["pdf"].includes(ext)) return "document";
    if (["docx", "doc"].includes(ext)) return "document";
    if (["hwp", "hwpx"].includes(ext)) return "document";
    if (["xlsx", "xls", "csv"].includes(ext)) return "spreadsheet";
    if (["jpg", "jpeg", "png", "gif"].includes(ext)) return "image";
    if (["txt"].includes(ext)) return "blank";
    
    // 확장자가 없으면 폴더로 간주할 수 있음
    if (ext === filename) return "folder";
    
    return "blank";
  };

  // 파일 업로드 처리
  const handleAddFile = async (newFile) => {
    if (!newFile) return;

    // 업로드를 위한 FormData 생성
    const formData = new FormData();
    formData.append("file", newFile);
    formData.append("path", currentPath); // 현재 경로 정보 추가

    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/documents/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 업로드 성공 후 문서 목록 새로고침
      fetchDocuments();
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("Error uploading document");
    } finally {
      setIsLoading(false);
    }
  };

  // 새 폴더 생성 처리 (document API로 통합)
  const handleCreateFolder = async (folderName) => {
    if (!folderName.trim()) return;

    try {
      setIsLoading(true);
      
      // 현재 경로에 따른 새 폴더 경로 생성
      const newFolderPath = currentPath === "/" 
        ? `/${folderName}` 
        : `${currentPath}/${folderName}`;
      
      // 새 디렉토리 객체 생성
      const newDir = {
        id: Math.random().toString(36).substr(2, 9),
        name: folderName,
        path: newFolderPath,
      };
      
      // 디렉토리 목록 업데이트
      const updatedDirs = [...directories, newDir];
      setDirectories(updatedDirs);
      
      // 새 폴더 객체 생성 (파일 리스트용)
      const newFolder = {
        id: newDir.id,
        name: folderName,
        type: "folder",
        path: currentPath,
        isDirectory: true,
        uploaded_at: new Date().toISOString(),
      };
      
      // 파일 목록 업데이트
      setFiles(prev => [...prev, newFolder]);
      
      // 백엔드와 디렉토리 구조 동기화
      await syncDirectoryStructure(updatedDirs);
      
      // 서버 API를 통한 폴더 생성 시도 (document API로 통합)
      try {
        const token = localStorage.getItem("token");
        await axios.post(
          `${API_BASE_URL}/documents/create-directory`,
          {
            name: folderName,
            path: currentPath,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        // 성공 시 문서 목록 새로고침
        fetchDocuments();
      } catch (apiError) {
        console.error("Server API error:", apiError);
        // API 오류 시 UI는 이미 업데이트되어 있으므로 추가 작업 필요 없음
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("폴더 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 폴더를 더블클릭하여 해당 폴더로 이동
  const handleFolderOpen = (folderPath) => {
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
      <Header onLogout={handleLogout} username={user?.username} />
      <div className="main-container">
        <Sidebar 
          directories={directories} 
          currentPath={currentPath} 
          setCurrentPath={setCurrentPath} 
          onRefresh={fetchDirectories}
        />
        <FileDisplay
          files={files}
          currentPath={currentPath}
          onAddFile={handleAddFile}
          onCreateFolder={handleCreateFolder}
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