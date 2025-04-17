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

      // 백엔드에서 받은 항목을 files 상태로 변환
      if (response.data && response.data.items) {
        setFiles(response.data.items);
      } else {
        setFiles([]);
      }
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

  // 파일 업로드 처리
  const handleAddFile = async (fileList, targetPath = currentPath, dirStructure = null) => {
    if (!fileList || fileList.length === 0) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      
      // FormData 생성
      const formData = new FormData();
      
      // 파일 추가
      for (let i = 0; i < fileList.length; i++) {
        formData.append('files', fileList[i]);
      }
      
      // 경로 정보 추가
      formData.append('path', targetPath);
      
      // 디렉토리 구조가 있는 경우 추가
      if (dirStructure) {
        formData.append('directory_structure', JSON.stringify(dirStructure));
      }
      
      // API 호출
      await axios.post(`${API_BASE_URL}/documents/manage`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });

      // 업로드 성공 후 문서 목록 새로고침
      fetchDocuments();
      // 디렉토리 구조도 새로고침
      fetchDirectories();
    } catch (error) {
      console.error("Error uploading files:", error);
      alert("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 새 폴더 생성 처리
  const handleCreateFolder = async (folderName) => {
    if (!folderName.trim()) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      
      // 폴더 생성 작업 정의
      const operations = [{
        operation_type: "create",
        name: folderName,
        path: currentPath
      }];
      
      // FormData 생성
      const formData = new FormData();
      formData.append('operations', JSON.stringify(operations));
      
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

  // 파일/폴더 이동 처리
  const handleMoveItem = async (itemId, newPath) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      
      // 이동 작업 정의
      const operations = [{
        operation_type: "move",
        item_id: itemId,
        new_path: newPath
      }];
      
      // FormData 생성
      const formData = new FormData();
      formData.append('operations', JSON.stringify(operations));
      
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
      console.error("Error moving item:", error);
      alert("항목 이동 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 파일/폴더 삭제 처리
  const handleDeleteItem = async (itemId) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      
      // 삭제 작업 정의
      const operations = [{
        operation_type: "delete",
        item_id: itemId
      }];
      
      // FormData 생성
      const formData = new FormData();
      formData.append('operations', JSON.stringify(operations));
      
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
      console.error("Error deleting item:", error);
      alert("항목 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 파일/폴더 이름 변경 처리
  const handleRenameItem = async (itemId, newName) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      
      // 이름 변경 작업 정의
      const operations = [{
        operation_type: "rename",
        item_id: itemId,
        name: newName
      }];
      
      // FormData 생성
      const formData = new FormData();
      formData.append('operations', JSON.stringify(operations));
      
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
      console.error("Error renaming item:", error);
      alert("이름 변경 중 오류가 발생했습니다.");
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