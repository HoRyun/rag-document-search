import axios from 'axios';

// API 기본 URL 설정
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 
  "http://rag-alb-547296323.ap-northeast-2.elb.amazonaws.com/fast_api";

// axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 타임아웃
});

// 현재 언어 가져오기 함수
const getCurrentLanguage = () => {
  // localStorage에서 언어 설정 가져오기
  const savedLanguage = localStorage.getItem('preferred-language');
  if (savedLanguage && ['ko', 'en'].includes(savedLanguage)) {
    return savedLanguage;
  }
  
  // 브라우저 언어 감지
  const browserLang = navigator.language || navigator.languages[0];
  if (browserLang.startsWith('ko')) {
    return 'ko';
  }
  
  // 기본값: 한국어
  return 'ko';
};

// 요청 인터셉터 - 모든 요청에 언어 정보 추가
apiClient.interceptors.request.use(
  (config) => {
    // 인증 토큰 추가
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 현재 언어 정보 추가
    const currentLanguage = getCurrentLanguage();
    config.headers['Accept-Language'] = currentLanguage;
    
    // 특정 엔드포인트들에 대해서는 body에도 language 필드 추가
    const languageRequiredEndpoints = [
      '/documents/query',
      '/operations/stage',
      '/operations/execute'
    ];
    
    const isLanguageRequired = languageRequiredEndpoints.some(endpoint => 
      config.url?.includes(endpoint)
    );
    
    if (isLanguageRequired) {
      // FormData인 경우 language 필드 추가
      if (config.data instanceof FormData) {
        config.data.append('language', currentLanguage);
      } 
      // JSON 데이터인 경우 language 필드 추가
      else if (config.data && typeof config.data === 'object') {
        config.data.language = currentLanguage;
      }
    }
    
    // 디버깅 로그
    console.log(`🌐 API 요청: ${config.method?.toUpperCase()} ${config.url}`);
    console.log(`🌍 언어: ${currentLanguage}`);
    
    return config;
  },
  (error) => {
    console.error('🚨 API 요청 인터셉터 오류:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리 및 다국어 에러 메시지
apiClient.interceptors.response.use(
  (response) => {
    // 성공 응답 로깅
    console.log(`✅ API 응답 성공: ${response.config.url} (${response.status})`);
    return response;
  },
  (error) => {
    const currentLanguage = getCurrentLanguage();
    
    // 에러 로깅
    console.error(`❌ API 응답 오류: ${error.config?.url}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // 다국어 에러 메시지 매핑
    const errorMessages = {
      ko: {
        400: '잘못된 요청입니다.',
        401: '인증이 필요합니다. 다시 로그인해주세요.',
        403: '접근 권한이 없습니다.',
        404: '요청한 리소스를 찾을 수 없습니다.',
        409: '이미 존재하는 항목입니다.',
        413: '파일 크기가 너무 큽니다.',
        422: '입력 데이터가 올바르지 않습니다.',
        429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        500: '서버 내부 오류가 발생했습니다.',
        502: '서버 연결에 문제가 있습니다.',
        503: '서버가 일시적으로 사용할 수 없습니다.',
        504: '서버 응답 시간이 초과되었습니다.',
        network: '네트워크 연결을 확인해주세요.',
        timeout: '요청 시간이 초과되었습니다.',
        unknown: '알 수 없는 오류가 발생했습니다.'
      },
      en: {
        400: 'Bad request.',
        401: 'Authentication required. Please login again.',
        403: 'Access denied.',
        404: 'The requested resource was not found.',
        409: 'The item already exists.',
        413: 'File size is too large.',
        422: 'Invalid input data.',
        429: 'Too many requests. Please try again later.',
        500: 'Internal server error occurred.',
        502: 'Server connection problem.',
        503: 'Server is temporarily unavailable.',
        504: 'Server response timeout.',
        network: 'Please check your network connection.',
        timeout: 'Request timeout.',
        unknown: 'An unknown error occurred.'
      }
    };
    
    // 에러 타입 결정
    let errorType = 'unknown';
    
    if (error.response) {
      // 서버 응답이 있는 경우
      errorType = error.response.status;
    } else if (error.request) {
      // 요청은 보냈지만 응답이 없는 경우
      errorType = 'network';
    } else if (error.code === 'ECONNABORTED') {
      // 타임아웃
      errorType = 'timeout';
    }
    
    // 다국어 에러 메시지 설정
    const localizedMessage = errorMessages[currentLanguage]?.[errorType] || 
                            errorMessages[currentLanguage]?.unknown ||
                            'An error occurred.';
    
    // 에러 객체에 다국어 메시지 추가
    error.localizedMessage = localizedMessage;
    
    // 401 오류 시 자동 로그아웃 처리
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // 필요시 Redux나 Context를 통해 전역 상태 업데이트
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// 언어별 API 엔드포인트 헬퍼 함수들
export const apiEndpoints = {
  // 인증 관련
  auth: {
    login: '/auth/token',
    register: '/auth/register',
    me: '/auth/me'
  },
  
  // 문서 관리
  documents: {
    list: '/documents',
    structure: '/documents/structure',
    manage: '/documents/manage',
    download: (fileId) => `/documents/${fileId}/download`,
    downloadZip: '/documents/download-zip',
    query: '/documents/query'
  },
  
  // 작업 관리 (챗봇 관련)
  operations: {
    stage: '/operations/stage',
    execute: (operationId) => `/operations/${operationId}/execute`,
    cancel: (operationId) => `/operations/${operationId}/cancel`,
    undo: (operationId) => `/operations/${operationId}/undo`
  }
};

// 파일 업로드 전용 함수 (진행률 추적 포함)
export const uploadFiles = (formData, onProgress = null) => {
  return apiClient.post(apiEndpoints.documents.manage, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    }
  });
};

// 파일 다운로드 전용 함수 (진행률 추적 포함)
export const downloadFile = (fileId, onProgress = null, abortSignal = null) => {
  return apiClient.get(apiEndpoints.documents.download(fileId), {
    responseType: 'blob',
    signal: abortSignal,
    onDownloadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted, progressEvent.loaded, progressEvent.total);
      }
    }
  });
};

// 챗봇 쿼리 전용 함수 (언어 정보 포함)
export const queryChatbot = (query, language = null) => {
  const formData = new FormData();
  formData.append('query', query);
  
  // 언어 정보 추가 (매개변수로 받거나 현재 언어 사용)
  const currentLanguage = language || getCurrentLanguage();
  formData.append('language', currentLanguage);
  
  console.log(`🤖 챗봇 쿼리 (${currentLanguage}):`, query);
  
  return apiClient.post(apiEndpoints.documents.query, formData);
};

// 작업 스테이징 함수 (챗봇 명령 처리, 언어 정보 포함)
export const stageOperation = (command, context, language = null) => {
  const currentLanguage = language || getCurrentLanguage();
  
  const requestData = {
    command,
    context,
    language: currentLanguage
  };
  
  console.log(`🎭 작업 스테이징 (${currentLanguage}):`, command);
  
  return apiClient.post(apiEndpoints.operations.stage, requestData);
};

// 다국어 지원 강화된 헬퍼 함수들
export const getLocalizedErrorMessage = (error) => {
  return error.localizedMessage || error.message || 'An error occurred.';
};

// 언어 변경 시 API 클라이언트 재구성 (필요시)
export const updateApiLanguage = (newLanguage) => {
  console.log(`🔄 API 언어 변경: ${newLanguage}`);
  // 필요시 여기에 추가 로직 구현
};

// 기본 API 클라이언트 내보내기
export default apiClient;