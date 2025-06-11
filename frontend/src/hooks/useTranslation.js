import { useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

// 번역 리소스 import
import koTranslations from '../i18n/locales/ko.json';
import enTranslations from '../i18n/locales/en.json';

// 번역 리소스 맵 - 컴포넌트 외부로 이동 (불변 객체)
const TRANSLATIONS = {
  ko: koTranslations,
  en: enTranslations
};

// 중첩된 객체에서 키로 값 찾기 (예: 'auth.login.title')
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
};

// 템플릿 문자열 처리 (예: "{{count}}개 파일" -> "5개 파일")
const interpolate = (template, variables = {}) => {
  if (typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
};

// 번역 훅 - useCallback으로 최적화
export const useTranslation = () => {
  const { currentLanguage } = useLanguage();
  
  // 번역 함수 - useCallback으로 메모이제이션
  const t = useCallback((key, variables = {}) => {
    try {
      // 현재 언어의 번역 리소스 가져오기
      const currentTranslations = TRANSLATIONS[currentLanguage];
      
      if (!currentTranslations) {
        console.warn(`Translation resource not found for language: ${currentLanguage}`);
        return key;
      }

      // 중첩된 키로 번역 값 찾기
      const translatedValue = getNestedValue(currentTranslations, key);
      
      if (translatedValue === null || translatedValue === undefined) {
        // 영어로 폴백 시도 (한국어에 없는 경우)
        if (currentLanguage !== 'en') {
          const fallbackValue = getNestedValue(TRANSLATIONS.en, key);
          if (fallbackValue !== null) {
            console.warn(`Translation missing for key '${key}' in ${currentLanguage}, using English fallback`);
            return interpolate(fallbackValue, variables);
          }
        }
        
        // 번역을 찾을 수 없는 경우 키 자체를 반환
        console.warn(`Translation not found for key: ${key}`);
        return key;
      }

      // 변수 치환하여 번역된 텍스트 반환
      return interpolate(translatedValue, variables);
      
    } catch (error) {
      console.error(`Error translating key '${key}':`, error);
      return key;
    }
  }, [currentLanguage]); // currentLanguage만 의존성으로

  // 복수형 처리 함수 - useCallback으로 메모이제이션
  const tn = useCallback((key, count, variables = {}) => {
    const baseKey = count === 1 ? `${key}.singular` : `${key}.plural`;
    const fallbackKey = key;
    
    // 복수형 키 시도
    let result = t(baseKey, { ...variables, count });
    
    // 복수형 키가 없으면 기본 키 사용
    if (result === baseKey) {
      result = t(fallbackKey, { ...variables, count });
    }
    
    return result;
  }, [t]);

  // 언어별 기본 옵션 - useMemo로 메모이제이션
  const dateFormatOptions = useMemo(() => ({
    ko: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    },
    en: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }
  }), []);

  // 날짜 형식화 함수 - useCallback으로 메모이제이션
  const formatDate = useCallback((date, options = {}) => {
    if (!date) return '';
    
    const dateObject = date instanceof Date ? date : new Date(date);
    
    const locale = currentLanguage === 'ko' ? 'ko-KR' : 'en-US';
    const formatOptions = { ...dateFormatOptions[currentLanguage], ...options };

    try {
      return new Intl.DateTimeFormat(locale, formatOptions).format(dateObject);
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateObject.toLocaleDateString();
    }
  }, [currentLanguage, dateFormatOptions]);

  // 숫자 형식화 함수 - useCallback으로 메모이제이션
  const formatNumber = useCallback((number, options = {}) => {
    if (typeof number !== 'number') return number;
    
    const locale = currentLanguage === 'ko' ? 'ko-KR' : 'en-US';
    
    try {
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      console.error('Number formatting error:', error);
      return number.toString();
    }
  }, [currentLanguage]);

  // 파일 크기 형식화 함수 - useCallback으로 메모이제이션
  const formatFileSize = useCallback((bytes, decimals = 1) => {
    if (bytes === 0) {
      return currentLanguage === 'ko' ? '0 바이트' : '0 Bytes';
    }
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    
    const sizes = currentLanguage === 'ko' 
      ? ['바이트', 'KB', 'MB', 'GB', 'TB']
      : ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    const formattedNumber = formatNumber(
      parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
    );
    
    return `${formattedNumber} ${sizes[i]}`;
  }, [currentLanguage, formatNumber]);

  // 상대적 시간 형식화 함수 - useCallback으로 메모이제이션
  const formatRelativeTime = useCallback((date) => {
    if (!date) return '';
    
    const dateObject = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now - dateObject) / 1000);
    
    // 1분 미만
    if (diffInSeconds < 60) {
      return currentLanguage === 'ko' ? '방금 전' : 'just now';
    }
    
    // 1시간 미만  
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return currentLanguage === 'ko' 
        ? `${minutes}분 전`
        : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    
    // 1일 미만
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return currentLanguage === 'ko'
        ? `${hours}시간 전`
        : `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // 1주일 미만
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return currentLanguage === 'ko'
        ? `${days}일 전`
        : `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    // 그 이상은 날짜 형식으로 표시
    return formatDate(dateObject, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }, [currentLanguage, formatDate]);

  // 메모이제이션된 반환 객체
  const returnValue = useMemo(() => ({
    t,           // 안정된 참조를 가진 번역 함수
    tn,          // 복수형 번역 함수
    formatDate,  // 날짜 형식화
    formatNumber, // 숫자 형식화
    formatFileSize, // 파일 크기 형식화
    formatRelativeTime, // 상대적 시간 형식화
    currentLanguage, // 현재 언어
    isKorean: currentLanguage === 'ko',
    isEnglish: currentLanguage === 'en'
  }), [
    t, 
    tn, 
    formatDate, 
    formatNumber, 
    formatFileSize, 
    formatRelativeTime, 
    currentLanguage
  ]);

  return returnValue;
};

export default useTranslation;