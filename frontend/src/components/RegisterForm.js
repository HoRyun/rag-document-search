import React, { useState } from "react";
import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api/v1";

const RegisterForm = ({ onRegisterSuccess }) => {
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
    <div className="register-form">
      <h2>회원가입</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleRegister}>
        <div className="form-group">
          <label htmlFor="username">사용자 이름:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">이메일:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">비밀번호:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? "가입 중..." : "가입하기"}
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
