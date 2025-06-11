import React, { useState } from "react";
import axios from "axios";
import { useTranslation } from "../../hooks/useTranslation";
import "./LoginForm.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/fast_api";

const LoginForm = ({ onLoginSuccess, onShowRegister }) => {
  const { t } = useTranslation();
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
      setError(t('auth.login.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <h2>{t('auth.login.title')}</h2>
          <p>{t('auth.login.subtitle')}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">{t('auth.login.username')}</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder={t('auth.login.usernamePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.login.password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={t('auth.login.passwordPlaceholder')}
            />
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? t('auth.login.loginInProgress') : t('auth.login.loginButton')}
          </button>
        </form>

        <div className="login-footer">
          <p>{t('auth.login.noAccount')}</p>
          <button onClick={onShowRegister} className="register-link">
            {t('auth.login.signUp')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;