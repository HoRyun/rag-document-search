import React, { useState } from "react";
import axios from "axios";
import "./RegisterForm.css";

const API_BASE_URL = "http://13.209.97.6:8000/fast_api";
//const API_BASE_URL = "http://localhost:8000/fast_api";

const RegisterForm = ({ onRegisterSuccess, onShowLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        username,
        password,
        email,
      });

      // 등록 성공 콜백 실행
      onRegisterSuccess();
    } catch (error) {
      console.error("Registration error:", error);
      setError("회원가입에 실패했습니다. 다른 사용자 이름을 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-form">
        <div className="register-header">
          <h2>회원가입</h2>
          <p>새 계정을 생성하여 파일 관리 시스템을 이용하세요</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleRegister}>
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
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="이메일을 입력하세요"
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

          <button
            type="submit"
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <div className="register-footer">
          <p>이미 계정이 있으신가요?</p>
          <button onClick={onShowLogin} className="login-link">
            로그인
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
