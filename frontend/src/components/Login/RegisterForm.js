import React, { useState } from "react";
import axios from "axios";
import { useTranslation } from "../../hooks/useTranslation";
import "./RegisterForm.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://rag-alb-547296323.ap-northeast-2.elb.amazonaws.com/fast_api";

const RegisterForm = ({ onRegisterSuccess, onShowLogin }) => {
  const { t } = useTranslation();
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
      setError(t('auth.register.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-form">
        <div className="register-header">
          <h2>{t('auth.register.title')}</h2>
          <p>{t('auth.register.subtitle')}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="username">{t('auth.register.username')}</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder={t('auth.register.usernamePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">{t('auth.register.email')}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t('auth.register.emailPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.register.password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={t('auth.register.passwordPlaceholder')}
            />
          </div>

          <button
            type="submit"
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? t('auth.register.registerInProgress') : t('auth.register.registerButton')}
          </button>
        </form>

        <div className="register-footer">
          <p>{t('auth.register.hasAccount')}</p>
          <button onClick={onShowLogin} className="login-link">
            {t('auth.register.signIn')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;