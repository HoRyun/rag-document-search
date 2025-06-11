import React, { createContext, useContext, useState, useEffect } from 'react';

// 지원 언어 목록
export const SUPPORTED_LANGUAGES = {
  ko: {
    code: 'ko',
    name: '한국어',
    flag: '🇰🇷',
    dateLocale: 'ko-KR'
  },
  en: {
    code: 'en', 
    name: 'English',
    flag: '🇺🇸',
    dateLocale: 'en-US'
  }
};

// 언어 컨텍스트 생성
const LanguageContext = createContext();

// 브라우저 언어 감지 함수
const detectBrowserLanguage = () => {
  const browserLang = navigator.language || navigator.languages[0];
  
  // 한국어 관련 언어 코드들
  if (browserLang.startsWith('ko')) {
    return 'ko';
  }
  
  // 기본값은 영어
  return 'en';
};

// 언어 컨텍스트 프로바이더
export const LanguageProvider = ({ children }) => {
  // 초기 언어 설정: localStorage > 브라우저 언어 > 기본값(한국어)
  const getInitialLanguage = () => {
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage]) {
      return savedLanguage;
    }
    
    const browserLanguage = detectBrowserLanguage();
    return browserLanguage;
  };

  const [currentLanguage, setCurrentLanguage] = useState(getInitialLanguage);
  
  // 언어 변경 함수
  const changeLanguage = (languageCode) => {
    if (SUPPORTED_LANGUAGES[languageCode]) {
      setCurrentLanguage(languageCode);
      localStorage.setItem('preferred-language', languageCode);
      
      // 디버깅 로그
      console.log(`🌍 언어 변경: ${SUPPORTED_LANGUAGES[languageCode].name}`);
    }
  };
  
  // 현재 언어 정보 가져오기
  const getCurrentLanguageInfo = () => {
    return SUPPORTED_LANGUAGES[currentLanguage];
  };

  // 언어 변경 시 문서 lang 속성 업데이트
  useEffect(() => {
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  const value = {
    currentLanguage,
    changeLanguage,
    getCurrentLanguageInfo,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isKorean: currentLanguage === 'ko',
    isEnglish: currentLanguage === 'en'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// 언어 컨텍스트 사용 훅
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  
  return context;
};

export default LanguageContext;