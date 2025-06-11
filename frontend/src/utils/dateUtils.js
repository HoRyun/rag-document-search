// 언어별 날짜 형식 설정
export const DATE_FORMATS = {
  ko: {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    medium: {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    },
    dateTime: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    },
    time: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    },
    timeWithSeconds: {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }
  },
  en: {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    medium: {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    },
    dateTime: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    },
    time: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    },
    timeWithSeconds: {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }
  }
};

// 언어별 로케일 매핑
export const LOCALES = {
  ko: 'ko-KR',
  en: 'en-US'
};

// 기본 날짜 형식화 함수
export const formatDate = (date, language = 'ko', format = 'medium') => {
  if (!date) return '';
  
  const dateObject = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObject.getTime())) {
    console.error('Invalid date provided:', date);
    return '';
  }
  
  const locale = LOCALES[language] || LOCALES.ko;
  const formatOptions = DATE_FORMATS[language]?.[format] || DATE_FORMATS.ko.medium;
  
  try {
    return new Intl.DateTimeFormat(locale, formatOptions).format(dateObject);
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateObject.toLocaleDateString();
  }
};

// 파일 수정 시간 형식화 (상대적 시간 + 절대 시간)
export const formatFileDate = (date, language = 'ko') => {
  if (!date) return '';
  
  const dateObject = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObject) / 1000);
  
  // 상대적 시간 텍스트
  const getRelativeTimeText = () => {
    if (diffInSeconds < 60) {
      return language === 'ko' ? '방금 전' : 'just now';
    }
    
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return language === 'ko' 
        ? `${minutes}분 전`
        : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return language === 'ko'
        ? `${hours}시간 전`
        : `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return language === 'ko'
        ? `${days}일 전`
        : `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    // 1주일 이상이면 절대 날짜 반환
    return formatDate(dateObject, language, 'short');
  };
  
  return getRelativeTimeText();
};

// 파일 크기 형식화 함수 (다국어 지원)
export const formatFileSize = (bytes, language = 'ko', decimals = 1) => {
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
  
  // 숫자 형식화 (한국어는 콤마, 영어는 콤마)
  const locale = LOCALES[language] || LOCALES.ko;
  const numberFormatted = new Intl.NumberFormat(locale).format(formattedNumber);
  
  return `${numberFormatted} ${sizes[i]}`;
};

// 상대적 시간 형식화 함수 (다국어 지원)
export const formatRelativeTime = (date, language = 'ko') => {
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

// 다운로드 진행률 시간 형식화
export const formatDuration = (seconds, language = 'ko') => {
  if (!seconds || seconds < 0) {
    return language === 'ko' ? '계산 중...' : 'calculating...';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (language === 'ko') {
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  } else {
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
};

// 남은 시간 추정 형식화
export const formatRemainingTime = (speed, remainingBytes, language = 'ko') => {
  if (speed === 0 || remainingBytes === 0) {
    return language === 'ko' ? '계산 중...' : 'calculating...';
  }
  
  const remainingSeconds = remainingBytes / speed;
  
  if (remainingSeconds < 60) {
    const seconds = Math.round(remainingSeconds);
    return language === 'ko' ? `약 ${seconds}초` : `about ${seconds}s`;
  } else if (remainingSeconds < 3600) {
    const minutes = Math.round(remainingSeconds / 60);
    return language === 'ko' ? `약 ${minutes}분` : `about ${minutes}m`;
  } else {
    const hours = Math.round(remainingSeconds / 3600);
    return language === 'ko' ? `약 ${hours}시간` : `about ${hours}h`;
  }
};

// 타임스탬프 형식화 (챗봇용)
export const formatTimestamp = (date, language = 'ko') => {
  const dateObject = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(dateObject.getFullYear(), dateObject.getMonth(), dateObject.getDate());
  
  const locale = LOCALES[language] || LOCALES.ko;
  
  // 오늘이면 시간만 표시
  if (dateOnly.getTime() === today.getTime()) {
    return new Intl.DateTimeFormat(locale, DATE_FORMATS[language].time).format(dateObject);
  }
  
  // 어제면 "어제 HH:MM" 형식
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (dateOnly.getTime() === yesterday.getTime()) {
    const timeStr = new Intl.DateTimeFormat(locale, DATE_FORMATS[language].time).format(dateObject);
    return language === 'ko' ? `어제 ${timeStr}` : `Yesterday ${timeStr}`;
  }
  
  // 일주일 이내면 "요일 HH:MM" 형식
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (dateObject > weekAgo) {
    const weekdayFormat = {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: language === 'ko'
    };
    return new Intl.DateTimeFormat(locale, weekdayFormat).format(dateObject);
  }
  
  // 그 이상이면 날짜 + 시간
  return new Intl.DateTimeFormat(locale, DATE_FORMATS[language].dateTime).format(dateObject);
};

// 업로드/수정 시간 정렬을 위한 비교 함수
export const compareDates = (dateA, dateB) => {
  const dateObjA = dateA instanceof Date ? dateA : new Date(dateA);
  const dateObjB = dateB instanceof Date ? dateB : new Date(dateB);
  
  return dateObjB.getTime() - dateObjA.getTime(); // 최신순
};

// 날짜 유효성 검증
export const isValidDate = (date) => {
  const dateObject = date instanceof Date ? date : new Date(date);
  return !isNaN(dateObject.getTime());
};

// 현재 시간 가져오기 (언어별 형식)
export const getCurrentTime = (language = 'ko', includeSeconds = false) => {
  const now = new Date();
  const locale = LOCALES[language] || LOCALES.ko;
  const format = includeSeconds 
    ? DATE_FORMATS[language].timeWithSeconds 
    : DATE_FORMATS[language].time;
  
  return new Intl.DateTimeFormat(locale, format).format(now);
};