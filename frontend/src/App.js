import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import FileDisplay from './components/FileDisplay/FileDisplay';
import Chatbot from './components/Chatbot/Chatbot';
import LoginForm from './components/Login/LoginForm';
import RegisterForm from './components/Login/RegisterForm';
import './App.css';

// API 기본 URL 설정
const API_BASE_URL = "http://localhost:8000/fast_api";

function App() {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [chatbotOpen, setChatbotOpen] = useState(false);
  
  // 인증 관련 상태
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [user, setUser] = useState(null);
  
  // RAG 관련 상태
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  
  // 컴포넌트 마운트 시 로그인 상태 확인
  useEffect(() => {
    // 토큰이 있으면 사용자 정보 가져오기
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserInfo(token);
    }
  }, []);

  // 인증 시 문서 목록 가져오기
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated]);

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

  // 문서 목록 가져오기
  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      // 백엔드에서 받은 문서를 files 상태로 변환
      const fetchedFiles = (response.data.documents || []).map(doc => ({
        id: doc.id || Math.random().toString(36).substr(2, 9),
        name: doc.filename,
        type: getFileType(doc.filename),
        path: currentPath,
        uploaded_at: doc.uploaded_at
      }));
      
      setFiles(fetchedFiles);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  // 파일 타입 유추
  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'document';
    if (['docx', 'doc'].includes(ext)) return 'document';
    if (['hwp', 'hwpx'].includes(ext)) return 'document';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'spreadsheet';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
    if (['txt'].includes(ext)) return 'blank';
    return 'blank';
  };

  // 파일 업로드 처리
  const handleAddFile = async (newFile) => {
    if (!newFile) return;
    
    // 업로드를 위한 FormData 생성
    const formData = new FormData();
    formData.append("file", newFile);
    
    try {
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
    }
  };
  
  // 질문 처리
  const handleQuery = async (queryText) => {
    if (!queryText.trim()) return;
    
    setQuery(queryText);
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
      setAnswer(answer);
      
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
        <Sidebar currentPath={currentPath} setCurrentPath={setCurrentPath} />
        <FileDisplay 
          files={files.filter(file => file.path === currentPath)} 
          currentPath={currentPath}
          onAddFile={handleAddFile}
          onRefresh={fetchDocuments}
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