import React, { useState, useEffect } from 'react';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import FileDisplay from './components/FileDisplay/FileDisplay';
import Chatbot from './components/Chatbot/Chatbot';
import LoginForm from './components/Login/LoginForm';
import RegisterForm from './components/Login/RegisterForm';
import './App.css';

function App() {
  const [files, setFiles] = useState([
    { id: 1, name: 'Document.pdf', type: 'document', path: '/documents' },
    { id: 2, name: 'Spreadsheet.xlsx', type: 'spreadsheet', path: '/documents' },
    { id: 3, name: 'Blank.txt', type: 'blank', path: '/documents' },
  ]);
  
  const [currentPath, setCurrentPath] = useState('/');
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  
  // 컴포넌트 마운트 시 로그인 상태 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  // 로그인 성공 핸들러
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  // 회원가입 양식으로 전환
  const handleShowRegister = () => {
    setShowRegister(true);
  };

  // 로그인 양식으로 전환
  const handleShowLogin = () => {
    setShowRegister(false);
  };

  // 회원가입 성공 핸들러
  const handleRegisterSuccess = () => {
    setShowRegister(false);
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  };

  // Add new file to the storage
  const handleAddFile = (newFile) => {
    setFiles([...files, { 
      id: files.length + 1, 
      name: newFile.name, 
      type: newFile.type.split('/')[1] || 'blank',
      path: currentPath 
    }]);
  };
  
  // Toggle chatbot visibility
  const toggleChatbot = () => {
    setChatbotOpen(!chatbotOpen);
  };

  // 로그인 상태에 따라 화면 렌더링
  if (!isLoggedIn) {
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
      <Header onLogout={handleLogout} />
      <div className="main-container">
        <Sidebar currentPath={currentPath} setCurrentPath={setCurrentPath} />
        <FileDisplay 
          files={files.filter(file => file.path === currentPath)} 
          currentPath={currentPath}
          onAddFile={handleAddFile} 
        />
      </div>
      <Chatbot isOpen={chatbotOpen} toggleChatbot={toggleChatbot} />
    </div>
  );
}

export default App;