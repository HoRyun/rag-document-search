import React, { useState } from "react";
import axios from "axios";
import "./LoginForm.css";

const API_BASE_URL = "http://13.209.97.6:8000/fast_api";
//const API_BASE_URL = "http://localhost:8000/fast_api";

const LoginForm = ({ onLoginSuccess, onShowRegister }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // FastAPI OAuth2 인증 방식에 맞게 FormData 사용
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const response = await axios.post(`${API_BASE_URL}/auth/token`, formData);

      // 토큰 저장
      localStorage.setItem("token", response.data.access_token);

      // 로그인 성공 콜백 실행
      onLoginSuccess();
    } catch (error) {
      console.error("Login error:", error);
      setError("로그인에 실패했습니다. 사용자 이름과 비밀번호를 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <h2>로그인</h2>
          <p>파일 관리 시스템에 오신 것을 환영합니다</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">사용자 이름</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="사용자 이름을 입력하세요"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="비밀번호를 입력하세요"
            />
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="login-footer">
          <p>계정이 없으신가요?</p>
          <button onClick={onShowRegister} className="register-link">
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
