// i18n/index.js - 다국어 시스템 메인 설정 파일

import { LanguageProvider, SUPPORTED_LANGUAGES } from '../contexts/LanguageContext';
import { formatDate } from '../utils/dateUtils'; // 존재하는 함수만 import

// 다국어 시스템 전역 설정
export const I18N_CONFIG = {
  // 기본 언어
  defaultLanguage: 'ko',
  
  // 지원 언어 목록
  supportedLanguages: Object.keys(SUPPORTED_LANGUAGES),
  
  // 폴백 언어 (번역이 없을 때 사용)
  fallbackLanguage: 'en',
  
  // 로컬 스토리지 키
  storageKey: 'preferred-language',
  
  // 브라우저 언어 자동 감지 여부
  detectBrowserLanguage: true,
  
  // 번역 누락 시 개발 모드에서 경고 표시
  showMissingTranslations: process.env.NODE_ENV === 'development'
};

// 번역 키 검증 함수 (개발 모드에서만 실행)
export const validateTranslationKey = (key, language) => {
  if (!I18N_CONFIG.showMissingTranslations) return;
  
  // 개발 모드에서만 번역 키 검증 로직 실행
  if (process.env.NODE_ENV === 'development') {
    console.group(`🌍 Translation Validation`);
    console.log(`Key: ${key}`);
    console.log(`Language: ${language}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.groupEnd();
  }
};

// 파일 크기 형식화 함수 (로컬 구현)
const formatFileSize = (bytes, language = 'ko', decimals = 1) => {
  if (bytes === 0) {
    return language === 'ko' ? '0 바이트' : '0 Bytes';
  }
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  
  const sizes = language === 'ko' 
    ? ['바이트', 'KB', 'MB', 'GB', 'TB']
    : ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  const formattedNumber = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  
  // 숫자 형식화
  const locale = language === 'ko' ? 'ko-KR' : 'en-US';
  const numberFormatted = new Intl.NumberFormat(locale).format(formattedNumber);
  
  return `${numberFormatted} ${sizes[i]}`;
};

// 상대적 시간 형식화 함수 (로컬 구현)
const formatRelativeTime = (date, language = 'ko') => {
  if (!date) return '';
  
  const dateObject = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObject) / 1000);
  
  // 1분 미만
  if (diffInSeconds < 60) {
    return language === 'ko' ? '방금 전' : 'just now';
  }
  
  // 1시간 미만  
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return language === 'ko' 
      ? `${minutes}분 전`
      : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  
  // 1일 미만
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return language === 'ko'
      ? `${hours}시간 전`
      : `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // 1주일 미만
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return language === 'ko'
      ? `${days}일 전`
      : `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // 그 이상은 날짜 형식으로 표시
  return formatDate(dateObject, language, 'short');
};

// 언어별 특수 형식화 함수들
export const formatters = {
  // 파일 크기 형식화
  fileSize: (bytes, language = 'ko') => {
    return formatFileSize(bytes, language);
  },
  
  // 날짜 형식화
  date: (date, language = 'ko', format = 'medium') => {
    return formatDate(date, language, format);
  },
  
  // 상대적 시간 형식화
  relativeTime: (date, language = 'ko') => {
    return formatRelativeTime(date, language);
  },
  
  // 숫자 형식화
  number: (number, language = 'ko', options = {}) => {
    const locale = language === 'ko' ? 'ko-KR' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      console.error('Number formatting error:', error);
      return number.toString();
    }
  },
  
  // 통화 형식화
  currency: (amount, language = 'ko', currency = 'KRW') => {
    const locale = language === 'ko' ? 'ko-KR' : 'en-US';
    const currencyCode = language === 'ko' ? 'KRW' : currency;
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode
      }).format(amount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return amount.toString();
    }
  }
};

// 언어별 상수 정의
export const LANGUAGE_CONSTANTS = {
  ko: {
    fileTypes: {
      folder: '폴더',
      document: '문서',
      image: '이미지',
      video: '동영상',
      audio: '오디오',
      archive: '압축파일',
      unknown: '알 수 없는 파일'
    },
    directions: {
      left: '왼쪽',
      right: '오른쪽',
      up: '위',
      down: '아래'
    },
    sizes: {
      small: '작음',
      medium: '보통',
      large: '큼'
    }
  },
  en: {
    fileTypes: {
      folder: 'Folder',
      document: 'Document',
      image: 'Image',
      video: 'Video',
      audio: 'Audio',
      archive: 'Archive',
      unknown: 'Unknown File'
    },
    directions: {
      left: 'Left',
      right: 'Right',
      up: 'Up',
      down: 'Down'
    },
    sizes: {
      small: 'Small',
      medium: 'Medium',
      large: 'Large'
    }
  }
};

// 파일 타입별 번역 가져오기
export const getFileTypeTranslation = (fileType, language = 'ko') => {
  const constants = LANGUAGE_CONSTANTS[language] || LANGUAGE_CONSTANTS.ko;
  return constants.fileTypes[fileType] || constants.fileTypes.unknown;
};

// RTL (Right-to-Left) 언어 지원 (향후 확장용)
export const RTL_LANGUAGES = [];

export const isRTLLanguage = (language) => {
  return RTL_LANGUAGES.includes(language);
};

// 언어별 정렬 규칙
export const getCollator = (language = 'ko') => {
  const locale = language === 'ko' ? 'ko-KR' : 'en-US';
  
  return new Intl.Collator(locale, {
    numeric: true,
    sensitivity: 'base'
  });
};

// 다국어 지원 시스템 초기화 함수
export const initializeI18n = () => {
  console.log('🌍 다국어 시스템 초기화 중...');
  
  // 언어 설정 검증
  const currentLanguage = localStorage.getItem(I18N_CONFIG.storageKey);
  if (currentLanguage && !I18N_CONFIG.supportedLanguages.includes(currentLanguage)) {
    console.warn(`⚠️ 지원되지 않는 언어: ${currentLanguage}`);
    localStorage.removeItem(I18N_CONFIG.storageKey);
  }
  
  // HTML lang 속성 설정
  const detectedLanguage = currentLanguage || I18N_CONFIG.defaultLanguage;
  document.documentElement.lang = detectedLanguage;
  
  // 디버그 정보 출력
  if (process.env.NODE_ENV === 'development') {
    console.group('🌍 I18n Configuration');
    console.log('Default Language:', I18N_CONFIG.defaultLanguage);
    console.log('Supported Languages:', I18N_CONFIG.supportedLanguages);
    console.log('Current Language:', detectedLanguage);
    console.log('Fallback Language:', I18N_CONFIG.fallbackLanguage);
    console.groupEnd();
  }
  
  console.log('✅ 다국어 시스템 초기화 완료');
};

// 언어 변경 이벤트 리스너
export const createLanguageChangeListener = (callback) => {
  const handler = (event) => {
    if (event.key === I18N_CONFIG.storageKey) {
      const newLanguage = event.newValue;
      if (newLanguage && I18N_CONFIG.supportedLanguages.includes(newLanguage)) {
        callback(newLanguage);
      }
    }
  };
  
  window.addEventListener('storage', handler);
  
  // 리스너 제거 함수 반환
  return () => {
    window.removeEventListener('storage', handler);
  };
};

// 번역 리소스 동적 로딩 (향후 확장용)
export const loadTranslationResources = async (language) => {
  try {
    // 동적 import를 사용한 번역 파일 로딩
    const translations = await import(`./locales/${language}.json`);
    return translations.default;
  } catch (error) {
    console.error(`번역 리소스 로딩 실패: ${language}`, error);
    
    // 폴백 언어로 재시도
    if (language !== I18N_CONFIG.fallbackLanguage) {
      console.log(`폴백 언어로 재시도: ${I18N_CONFIG.fallbackLanguage}`);
      return loadTranslationResources(I18N_CONFIG.fallbackLanguage);
    }
    
    return null;
  }
};

// 다국어 Provider 컴포넌트 래퍼
export const I18nProvider = LanguageProvider;

// 기본 export
export default {
  I18N_CONFIG,
  formatters,
  LANGUAGE_CONSTANTS,
  getFileTypeTranslation,
  isRTLLanguage,
  getCollator,
  initializeI18n,
  createLanguageChangeListener,
  loadTranslationResources,
  I18nProvider
};