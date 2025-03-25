import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";

// API 기본 URL 설정
const API_BASE_URL = "http://localhost:8000/api/v1";

function App() {
  const [file, setFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 토큰이 있으면 사용자 정보 가져오기
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserInfo(token);
    }
  }, []);

  useEffect(() => {
    // 인증된 경우에만 문서 목록 가져오기
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated]);

  const fetchUserInfo = async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/users/me`, {
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

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  // 파일 선택 핸들러
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // 파일 업로드 함수
  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/documents/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setFile(null); // 파일 업로드가 성공적으로 완료된 후에 파일 상태를 초기화하는 작업
      fetchDocuments();
      alert("Document uploaded successfully");
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("Error uploading document");
    } finally {
      setIsUploading(false);
    }
  };

  // 질문 입력 후 서버에 질문을 보내고 답변을 받아오는 함수
  const handleQuery = async () => {
    if (!query.trim()) return;

    const formData = new FormData();
    formData.append("query", query);

    setIsQuerying(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/documents/query`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setAnswer(response.data.answer);
    } catch (error) {
      console.error("Error querying:", error);
      setAnswer("Error processing your query");
    } finally {
      setIsQuerying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleLoginSuccess = () => {
    const token = localStorage.getItem("token");
    fetchUserInfo(token);
  };

  const handleRegisterSuccess = () => {
    // 등록 후 로그인 화면으로 전환
    setShowRegister(false);
  };

  // 인증되지 않은 경우 로그인/회원가입 화면 표시
  if (!isAuthenticated) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>RAG Document Search</h1>
        </header>
        <main className="auth-container">
          {showRegister ? (
            <>
              <RegisterForm onRegisterSuccess={handleRegisterSuccess} />
              <p>
                이미 계정이 있으신가요?{" "}
                <button onClick={() => setShowRegister(false)}>로그인</button>
              </p>
            </>
          ) : (
            <>
              <LoginForm onLoginSuccess={handleLoginSuccess} />
              <p>
                계정이 없으신가요?{" "}
                <button onClick={() => setShowRegister(true)}>회원가입</button>
              </p>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>RAG Document Search</h1>
        <div className="user-info">
          <span>안녕하세요, {user?.username}님</span>
          <button onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      <main>
        <section className="upload-section">
          <h2>Upload Document</h2>
          <div className="upload-form">
            {/* 유저가 파일을 업로드하는 필드*/}
            <input
              type="file"
              accept=".pdf,.docx,.hwp,.hwpx"
              onChange={handleFileChange}
            />
            {/* 유저가 파일을 업로드하는 필드*/}
            <button onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </section>

        <section className="documents-section">
          <h2>Documents ({documents.length})</h2>
          <ul className="document-list">
            {documents.map((doc, index) => (
              <li key={index} className="document-item">
                <span>{doc.filename}</span>
                <span>{new Date(doc.uploaded_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="query-section">
          <h2>Ask a Question</h2>
          <div className="query-form">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your question here..."
              rows={3}
            />

            <button
              onClick={handleQuery}
              disabled={!query.trim() || isQuerying}
            >
              {isQuerying ? "Processing..." : "Ask"}
            </button>
          </div>

          {answer && (
            <div className="answer-container">
              <h3>Answer:</h3>
              <div className="answer-content">{answer}</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
