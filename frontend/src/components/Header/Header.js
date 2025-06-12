import React from 'react';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import LanguageSelector from '../LanguageSelector/LanguageSelector';
import { useTranslation } from '../../hooks/useTranslation';
import './Header.css';

const Header = ({ onLogout, username, isDarkMode, toggleTheme }) => {
  const { t } = useTranslation();

  return (
    <header className="header">
      <div className="logo">
        <h1>{t('header.title')}</h1>
      </div>
      <div className="search-bar">
        <input 
          type="text" 
          placeholder={t('header.searchPlaceholder')} 
        />
      </div>
      <div className="user-actions">
        <LanguageSelector />
        <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />
        <span className="username">
          {username ? `${username}${t('common.suffix', '')}` : ''}
        </span>
        <button className="menu-btn">{t('header.menu')}</button>
        <button className="user-btn">{t('header.user')}</button>
        <button className="logout-btn" onClick={onLogout}>
          {t('header.logout')}
        </button>
      </div>
    </header>
  );
};

export default Header;