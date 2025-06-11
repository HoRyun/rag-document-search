import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTranslation } from '../../hooks/useTranslation';
import './LanguageSelector.css';

const LanguageSelector = () => {
  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 외부 클릭 감지하여 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageChange = (languageCode) => {
    changeLanguage(languageCode);
    setIsOpen(false);
    
    // 언어 변경 완료 로그
    console.log(`🌍 Language changed to: ${supportedLanguages[languageCode].name}`);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const currentLangInfo = supportedLanguages[currentLanguage];

  return (
    <div className="language-selector" ref={dropdownRef}>
      <button 
        className="language-toggle"
        onClick={toggleDropdown}
        aria-label={t('header.language')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="language-flag">{currentLangInfo.flag}</span>
        <span className="language-name">{currentLangInfo.name}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="language-dropdown" role="listbox">
          {Object.values(supportedLanguages).map((lang) => (
            <button
              key={lang.code}
              className={`language-option ${currentLanguage === lang.code ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
              role="option"
              aria-selected={currentLanguage === lang.code}
            >
              <span className="language-flag">{lang.flag}</span>
              <span className="language-name">{lang.name}</span>
              {currentLanguage === lang.code && (
                <span className="check-mark">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;