// ===== 다국어 지원 강화된 CommandProcessor.js =====

// 기존 상수들 유지 및 확장
export const COMMAND_TYPES = {
  DOCUMENT_SEARCH: 'DOCUMENT_SEARCH',
  MOVE_DOCUMENT: 'MOVE_DOCUMENT',
  COPY_DOCUMENT: 'COPY_DOCUMENT',
  DELETE_DOCUMENT: 'DELETE_DOCUMENT',
  CREATE_FOLDER: 'CREATE_FOLDER',
  SUMMARIZE_DOCUMENT: 'SUMMARIZE_DOCUMENT',
  RENAME_DOCUMENT: 'RENAME_DOCUMENT',
  UNDO: 'UNDO',
  UNKNOWN: 'UNKNOWN'
};

export const OPERATION_TYPES = {
  MOVE: 'move',
  COPY: 'copy',
  DELETE: 'delete',
  RENAME: 'rename',
  CREATE_FOLDER: 'create_folder',
  SEARCH: 'search',
  SUMMARIZE: 'summarize'
};

export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// 디버깅 헬퍼 함수들
const debugLog = (category, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logStyle = {
    stage: 'background: #007bff; color: white; padding: 2px 5px; border-radius: 3px;',
    execute: 'background: #28a745; color: white; padding: 2px 5px; border-radius: 3px;',
    cancel: 'background: #ffc107; color: black; padding: 2px 5px; border-radius: 3px;',
    undo: 'background: #dc3545; color: white; padding: 2px 5px; border-radius: 3px;',
    error: 'background: #dc3545; color: white; padding: 2px 5px; border-radius: 3px;',
    response: 'background: #6f42c1; color: white; padding: 2px 5px; border-radius: 3px;',
    language: 'background: #17a2b8; color: white; padding: 2px 5px; border-radius: 3px;'
  };

  console.groupCollapsed(`%c🤖 [${category.toUpperCase()}] ${message}`, logStyle[category] || '');
  console.log('⏰ 시간:', timestamp);
  if (data) {
    console.log('📦 데이터:', data);
  }
  console.groupEnd();
};

const logNetworkRequest = (method, url, requestData) => {
  console.group(`%c🌐 네트워크 요청`, 'background: #17a2b8; color: white; padding: 2px 5px; border-radius: 3px;');
  console.log('🔗 Method:', method);
  console.log('🔗 URL:', url);
  console.log('📤 Request Headers:', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')?.substring(0, 20)}...`,
    'Accept-Language': requestData.language || 'ko'
  });
  console.log('📤 Request Body:', JSON.stringify(requestData, null, 2));
  console.groupEnd();
};

const logNetworkResponse = (url, responseData, status) => {
  const isSuccess = status >= 200 && status < 300;
  const style = isSuccess 
    ? 'background: #28a745; color: white; padding: 2px 5px; border-radius: 3px;'
    : 'background: #dc3545; color: white; padding: 2px 5px; border-radius: 3px;';
  
  console.group(`%c📡 네트워크 응답 ${status}`, style);
  console.log('🔗 URL:', url);
  console.log('📥 Response:', responseData);
  console.groupEnd();
};

// API 서비스 클래스 (언어 정보 포함)
class OperationService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_BASE_URL || "http://rag-alb-547296323.ap-northeast-2.elb.amazonaws.com/fast_api";
    debugLog('stage', '🔧 OperationService 초기화됨', { baseURL: this.baseURL });
  }

  async stageOperation(command, context) {
    const url = `${this.baseURL}/operations/stage`;
    const requestData = {
      command,
      context: {
        currentPath: context.currentPath,
        selectedFiles: context.selectedFiles,
        availableFolders: context.availableFolders,
        timestamp: new Date().toISOString()
      },
      language: context.language || 'ko'
    };

    debugLog('language', '🌍 언어 정보와 함께 작업 준비 요청', { 
      command, 
      language: context.language,
      context 
    });
    logNetworkRequest('POST', url, requestData);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept-Language': context.language || 'ko'
        },
        body: JSON.stringify(requestData)
      });

      const responseData = await response.json();
      logNetworkResponse(url, responseData, response.status);

      if (!response.ok) {
        debugLog('error', '❌ Stage 요청 실패', { 
          status: response.status, 
          statusText: response.statusText,
          response: responseData,
          language: context.language
        });
        throw new Error(`작업 준비 실패: ${response.statusText}`);
      }

      debugLog('stage', '✅ 작업 준비 성공 (다국어)', { 
        ...responseData, 
        language: context.language 
      });
      return responseData;

    } catch (error) {
      debugLog('error', '💥 Stage 네트워크 오류', { 
        error: error.message,
        url,
        requestData,
        language: context.language
      });
      throw error;
    }
  }

  async executeOperation(operationId, userConfirmation = {}, language = 'ko') {
    const url = `${this.baseURL}/operations/${operationId}/execute`;
    const requestData = {
      confirmed: true,
      userOptions: userConfirmation,
      language: language, // 언어 정보 추가
      executionTime: new Date().toISOString()
    };

    debugLog('language', '🌍 언어 정보와 함께 작업 실행 요청', { 
      operationId, 
      userConfirmation, 
      language 
    });
    logNetworkRequest('POST', url, requestData);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept-Language': language
        },
        body: JSON.stringify(requestData)
      });

      const responseData = await response.json();
      logNetworkResponse(url, responseData, response.status);

      if (!response.ok) {
        debugLog('error', '❌ Execute 요청 실패', { 
          operationId,
          status: response.status, 
          statusText: response.statusText,
          response: responseData,
          language
        });
        throw new Error(`작업 실행 실패: ${response.statusText}`);
      }

      debugLog('execute', '✅ 작업 실행 성공 (다국어)', { 
        ...responseData, 
        language 
      });
      return responseData;

    } catch (error) {
      debugLog('error', '💥 Execute 네트워크 오류', { 
        operationId,
        error: error.message,
        url,
        requestData,
        language
      });
      throw error;
    }
  }

  async cancelOperation(operationId, language = 'ko') {
    const url = `${this.baseURL}/operations/${operationId}/cancel`;
    const requestData = { language }; // 언어 정보 추가

    debugLog('language', '🌍 언어 정보와 함께 작업 취소 요청', { operationId, language });
    logNetworkRequest('POST', url, requestData);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept-Language': language
        },
        body: JSON.stringify(requestData)
      });

      const responseData = await response.json();
      logNetworkResponse(url, responseData, response.status);

      if (!response.ok) {
        debugLog('error', '❌ Cancel 요청 실패', { 
          operationId,
          status: response.status, 
          statusText: response.statusText,
          response: responseData,
          language
        });
        throw new Error(`작업 취소 실패: ${response.statusText}`);
      }

      debugLog('cancel', '✅ 작업 취소 성공 (다국어)', { 
        ...responseData, 
        language 
      });
      return responseData;

    } catch (error) {
      debugLog('error', '💥 Cancel 네트워크 오류', { 
        operationId,
        error: error.message,
        url,
        language
      });
      throw error;
    }
  }

  async undoOperation(operationId, reason = '', language = 'ko') {
    const url = `${this.baseURL}/operations/${operationId}/undo`;
    const requestData = {
      reason,
      language, // 언어 정보 추가
      undoTime: new Date().toISOString()
    };

    debugLog('language', '🌍 언어 정보와 함께 작업 되돌리기 요청', { 
      operationId, 
      reason, 
      language 
    });
    logNetworkRequest('POST', url, requestData);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept-Language': language
        },
        body: JSON.stringify(requestData)
      });

      const responseData = await response.json();
      logNetworkResponse(url, responseData, response.status);

      if (!response.ok) {
        debugLog('error', '❌ Undo 요청 실패', { 
          operationId,
          status: response.status, 
          statusText: response.statusText,
          response: responseData,
          language
        });
        throw new Error(`작업 취소 실패: ${response.statusText}`);
      }

      debugLog('undo', '✅ 작업 되돌리기 성공 (다국어)', { 
        ...responseData, 
        language 
      });
      return responseData;

    } catch (error) {
      debugLog('error', '💥 Undo 네트워크 오류', { 
        operationId,
        error: error.message,
        url,
        requestData,
        language
      });
      throw error;
    }
  }
}

// 언어별 패턴 정의 (다국어 지원 강화)
const PATTERNS = {
  ko: {
    SEARCH: [
      /찾아/i, /검색/i, /어디에?\s*있(어|나|습니까)/i, 
      /위치/i, /경로/i, /어디\s*있/i
    ],
    MOVE: [
      /이동/i, /(옮기|옮겨)/i, /위치\s*변경/i, /경로\s*변경/i,
      /(.*)(을|를|파일|문서|폴더)?\s*(.*)(으로|로)?\s*이동/i
    ],
    COPY: [
      /복사/i, /복제/i, /사본/i, /카피/i,
      /(.*)(을|를|파일|문서)?\s*(.*)(으로|로)?\s*복사/i
    ],
    DELETE: [
      /삭제/i, /제거/i, /지우/i, /없애/i, /휴지통/i,
      /(.*)(을|를|파일|문서)?\s*삭제/i
    ],
    CREATE_FOLDER: [
      /폴더\s*(를|을)?\s*(만들|생성|추가)/i, /(디렉토리|디렉터리)\s*(를|을)?\s*(만들|생성|추가)/i,
      /(새|신규)\s*폴더/i, /(.*)(에|위치에|경로에)?\s*폴더\s*(를|을)?\s*(만들|생성|추가)/i
    ],
    SUMMARIZE: [
      /요약/i, /줄이/i, /정리/i, /핵심/i, /중요\s*내용/i,
      /(.*)(을|를|파일|문서)?\s*요약/i
    ],
    RENAME: [
      /이름\s*변경/i, /이름\s*바꾸/i, /바꿔/i, /rename/i,
      /(.*)(을|를|파일|문서)?\s*(.*)(으로|로)?\s*(이름\s*변경|바꿔)/i
    ],
    UNDO: [
      /되돌리/i, /취소/i, /원래대로/i, /방금.*되돌리/i, /실행.*취소/i, /undo/i
    ]
  },
  en: {
    SEARCH: [
      /find/i, /search/i, /where\s+is/i, /locate/i, /look\s+for/i
    ],
    MOVE: [
      /move/i, /relocate/i, /transfer/i, /move\s+to/i
    ],
    COPY: [
      /copy/i, /duplicate/i, /clone/i, /copy\s+to/i
    ],
    DELETE: [
      /delete/i, /remove/i, /erase/i, /trash/i
    ],
    CREATE_FOLDER: [
      /create\s+folder/i, /new\s+folder/i, /make\s+directory/i, /add\s+folder/i
    ],
    SUMMARIZE: [
      /summarize/i, /summary/i, /overview/i, /brief/i
    ],
    RENAME: [
      /rename/i, /change\s+name/i, /rename\s+to/i
    ],
    UNDO: [
      /undo/i, /revert/i, /cancel/i, /rollback/i
    ]
  }
};

// 수정된 CommandProcessor (언어 정보 포함)
export const CommandProcessor = {
  operationService: new OperationService(),

  // 수정된 분석 함수 (언어 정보 포함)
  analyzeCommand: async function(message, context) {
    const language = context.language || 'ko';
    
    debugLog('language', '🧠 다국어 백엔드 명령어 분석 시작', { 
      message, 
      language, 
      context 
    });
    
    try {
      // 백엔드에서 명령 분석 및 작업 준비 (언어 정보 포함)
      const stagedOperation = await this.operationService.stageOperation(message, context);
      
      const result = {
        success: true,
        operationId: stagedOperation.operationId,
        operation: stagedOperation.operation,
        requiresConfirmation: stagedOperation.requiresConfirmation,
        riskLevel: stagedOperation.riskLevel,
        preview: stagedOperation.preview,
        language: language
      };

      debugLog('stage', '✅ 다국어 백엔드 명령 분석 성공', result);
      return result;

    } catch (error) {
      debugLog('error', '❌ 다국어 백엔드 명령 분석 실패', { 
        error: error.message,
        message,
        language,
        context 
      });
      
      // 백엔드 실패 시 에러를 다시 throw
      throw new Error(`백엔드 분석 실패 (${language}): ${error.message}`);
    }
  },

  // 작업 실행 (언어 정보 포함)
  executeOperation: async function(operationId, userConfirmation, language = 'ko') {
    debugLog('language', '🚀 다국어 작업 실행 시작', { 
      operationId, 
      userConfirmation, 
      language 
    });
    
    try {
      const result = await this.operationService.executeOperation(operationId, userConfirmation, language);
      
      const successResult = {
        success: true,
        result,
        language
      };
      
      debugLog('execute', '✅ 다국어 작업 실행 성공', successResult);
      return successResult;

    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        language
      };
      
      debugLog('error', '❌ 다국어 작업 실행 실패', errorResult);
      return errorResult;
    }
  },

  // 작업 취소 (언어 정보 포함)
  cancelOperation: async function(operationId, language = 'ko') {
    debugLog('language', '⏹️ 다국어 작업 취소 시작', { operationId, language });
    
    try {
      const result = await this.operationService.cancelOperation(operationId, language);
      
      const successResult = {
        success: true,
        result,
        language
      };
      
      debugLog('cancel', '✅ 다국어 작업 취소 성공', successResult);
      return successResult;

    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        language
      };
      
      debugLog('error', '❌ 다국어 작업 취소 실패', errorResult);
      return errorResult;
    }
  },

  // 작업 되돌리기 (언어 정보 포함)
  undoOperation: async function(operationId, reason, language = 'ko') {
    debugLog('language', '↩️ 다국어 작업 되돌리기 시작', { operationId, reason, language });
    
    try {
      const result = await this.operationService.undoOperation(operationId, reason, language);
      
      const successResult = {
        success: true,
        result,
        language
      };
      
      debugLog('undo', '✅ 다국어 작업 되돌리기 성공', successResult);
      return successResult;

    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        language
      };
      
      debugLog('error', '❌ 다국어 작업 되돌리기 실패', errorResult);
      return errorResult;
    }
  },

  // 복원된 processMessage 함수 (다국어 폴백용)
  processMessage: function(message, files = [], directories = [], context = {}) {
    const language = context.language || 'ko';
    
    debugLog('language', '🔄 다국어 로컬 명령 분석 시작 (폴백 모드)', { 
      message, 
      language,
      fileCount: files.length, 
      dirCount: directories.length,
      context 
    });
    
    const { currentPath = '/', selectedFiles = [] } = context;
    const lowerMsg = message.toLowerCase();
    let commandType = COMMAND_TYPES.UNKNOWN;
    
    // 현재 언어에 맞는 패턴 선택
    const currentPatterns = PATTERNS[language] || PATTERNS.ko;
    
    // 되돌리기 명령 체크
    if (currentPatterns.UNDO && currentPatterns.UNDO.some(pattern => pattern.test(lowerMsg))) {
      const result = {
        type: COMMAND_TYPES.UNDO,
        success: true,
        message: language === 'ko' ? '최근 작업을 되돌리시겠습니까?' : 'Would you like to undo the recent operation?',
        language
      };
      debugLog('stage', '✅ 되돌리기 명령 인식 (다국어)', result);
      return result;
    }
    
    // 언어별 패턴 매칭 로직
    if (currentPatterns.SEARCH.some(pattern => pattern.test(lowerMsg))) {
      commandType = COMMAND_TYPES.DOCUMENT_SEARCH;
    } else if (currentPatterns.MOVE.some(pattern => pattern.test(lowerMsg))) {
      commandType = COMMAND_TYPES.MOVE_DOCUMENT;
    } else if (currentPatterns.COPY.some(pattern => pattern.test(lowerMsg))) {
      commandType = COMMAND_TYPES.COPY_DOCUMENT;
    } else if (currentPatterns.DELETE.some(pattern => pattern.test(lowerMsg))) {
      commandType = COMMAND_TYPES.DELETE_DOCUMENT;
    } else if (currentPatterns.CREATE_FOLDER.some(pattern => pattern.test(lowerMsg))) {
      commandType = COMMAND_TYPES.CREATE_FOLDER;
    } else if (currentPatterns.SUMMARIZE.some(pattern => pattern.test(lowerMsg))) {
      commandType = COMMAND_TYPES.SUMMARIZE_DOCUMENT;
    } else if (currentPatterns.RENAME && currentPatterns.RENAME.some(pattern => pattern.test(lowerMsg))) {
      commandType = COMMAND_TYPES.RENAME_DOCUMENT;
    }
    
    debugLog('stage', '🎯 명령 타입 인식 (다국어)', { commandType, language });

    // 다국어 지원 extractors 함수들
    const localExtractors = {
      extractFileName: (message, selectedFiles = []) => {
        // 언어별 선택된 파일 표현 패턴
        const selectedPatterns = language === 'ko' ? [
          /선택(된|한)\s*(파일|문서|항목)(들?)/i,
          /(이|그)\s*(파일|문서)(들?)/i,
          /현재\s*선택(된|한)/i,
          /지금\s*선택(된|한)/i
        ] : [
          /selected\s*(file|document|item)s?/i,
          /(this|that)\s*(file|document)s?/i,
          /current(ly)?\s*selected/i
        ];
        
        for (const pattern of selectedPatterns) {
          if (pattern.test(message) && selectedFiles.length > 0) {
            return selectedFiles[0].name;
          }
        }
        
        const quotedMatch = message.match(/"([^"]+)"|'([^']+)'/);
        if (quotedMatch) {
          return quotedMatch[1] || quotedMatch[2];
        }
        
        const extensionMatch = message.match(/\b[\w\s-]+\.(pdf|docx?|xlsx?|pptx?|txt|jpg|png|hwp|zip)\b/i);
        if (extensionMatch) {
          return extensionMatch[0];
        }
        
        return null;
      },
      
      extractPath: (message, currentPath = '/') => {
        // 언어별 "여기에" 표현 패턴
        const herePatterns = language === 'ko' ? [
          /여기(에|로|서)/i,
          /현재\s*(위치|폴더|경로)(에|로)/i,
          /이\s*(위치|폴더|경로)(에|로)/i,
          /지금\s*(여기|위치)(에|로)/i
        ] : [
          /here/i,
          /current\s*(location|folder|path)/i,
          /this\s*(location|folder|path)/i
        ];
        
        for (const pattern of herePatterns) {
          if (pattern.test(message)) {
            return currentPath;
          }
        }
        
        // 언어별 공통 폴더명
        const commonFolders = language === 'ko' ? 
          ['문서', '사진', '다운로드', '음악', '비디오', '프로젝트', '재무', '마케팅', '인사', '개인', '아카이브', '백업'] :
          ['documents', 'photos', 'downloads', 'music', 'videos', 'projects', 'finance', 'marketing', 'hr', 'personal', 'archive', 'backup'];
          
        for (const folder of commonFolders) {
          if (message.toLowerCase().includes(folder)) {
            return `/${folder}`;
          }
        }
        
        return currentPath;
      },
      
      getTargetFiles: (message, selectedFiles = [], allFiles = []) => {
        // 언어별 선택된 파일 표현 패턴
        const selectedPatterns = language === 'ko' ? [
          /선택(된|한)\s*(파일|문서|항목)(들?)/i,
          /(이|그)\s*(파일|문서)(들?)/i,
          /현재\s*선택(된|한)/i
        ] : [
          /selected\s*(file|document|item)s?/i,
          /(this|that)\s*(file|document)s?/i,
          /current(ly)?\s*selected/i
        ];
        
        for (const pattern of selectedPatterns) {
          if (pattern.test(message) && selectedFiles.length > 0) {
            return selectedFiles;
          }
        }
        
        // 구체적인 파일명이 언급된 경우
        const fileName = localExtractors.extractFileName(message, selectedFiles);
        if (fileName) {
          const matchedFile = allFiles.find(file => 
            file.name.toLowerCase().includes(fileName.toLowerCase())
          );
          if (matchedFile) {
            return [matchedFile];
          }
        }
        
        // 아무것도 없으면 선택된 파일들 반환
        if (selectedFiles.length > 0) {
          return selectedFiles;
        }
        
        return [];
      }
    };

    // 명령 타입별 처리 (다국어 지원)
    switch (commandType) {
      case COMMAND_TYPES.DOCUMENT_SEARCH: {
        const fileName = localExtractors.extractFileName(message, selectedFiles);
        const searchKeywords = language === 'ko' ? 
          ['찾아', '검색', '어디에', '있어', '있나', '위치', '경로'] :
          ['find', 'search', 'where', 'locate', 'look'];
        
        let searchTerm = fileName || message;
        searchKeywords.forEach(keyword => {
          searchTerm = searchTerm.replace(new RegExp(keyword, 'gi'), '');
        });
        searchTerm = searchTerm.trim();
        
        const searchResults = files
          .filter(file => {
            if (!searchTerm) return false;
            return file.name.toLowerCase().includes(searchTerm.toLowerCase());
          })
          .slice(0, 5);
        
        const result = {
          type: COMMAND_TYPES.DOCUMENT_SEARCH,
          query: searchTerm,
          results: searchResults,
          success: true,
          language,
          operation: {
            type: OPERATION_TYPES.SEARCH,
            searchTerm: searchTerm,
            requiresConfirmation: false
          }
        };
        
        debugLog('stage', '✅ 검색 명령 처리 완료 (다국어)', result);
        return result;
      }
      
      case COMMAND_TYPES.MOVE_DOCUMENT: {
        const targetFiles = localExtractors.getTargetFiles(message, selectedFiles, files);
        const targetPath = localExtractors.extractPath(message, currentPath);
        
        if (targetFiles.length === 0) {
          const errorMessage = language === 'ko' ? 
            '이동할 파일을 찾을 수 없습니다. 파일을 선택하거나 파일명을 명시해주세요.' :
            'Cannot find files to move. Please select files or specify file names.';
            
          const errorResult = {
            type: COMMAND_TYPES.MOVE_DOCUMENT,
            success: false,
            error: errorMessage,
            language
          };
          debugLog('error', '❌ 이동할 파일 없음 (다국어)', errorResult);
          return errorResult;
        }
        
        const previewMessage = language === 'ko' ?
          `${targetFiles.length}개 파일을 "${targetPath}" 경로로 이동합니다.` :
          `Moving ${targetFiles.length} file(s) to "${targetPath}" path.`;
        
        const result = {
          type: COMMAND_TYPES.MOVE_DOCUMENT,
          documents: targetFiles,
          targetPath: targetPath,
          previewAction: previewMessage,
          success: true,
          language,
          operation: {
            type: OPERATION_TYPES.MOVE,
            targets: targetFiles,
            destination: targetPath,
            requiresConfirmation: true
          },
          riskLevel: RISK_LEVELS.MEDIUM,
          requiresConfirmation: true
        };
        
        debugLog('stage', '✅ 이동 명령 처리 완료 (다국어)', result);
        return result;
      }
      
      case COMMAND_TYPES.COPY_DOCUMENT: {
        const targetFiles = localExtractors.getTargetFiles(message, selectedFiles, files);
        const targetPath = localExtractors.extractPath(message, currentPath);
        
        if (targetFiles.length === 0) {
          const errorMessage = language === 'ko' ? 
            '복사할 파일을 찾을 수 없습니다. 파일을 선택하거나 파일명을 명시해주세요.' :
            'Cannot find files to copy. Please select files or specify file names.';
            
          const errorResult = {
            type: COMMAND_TYPES.COPY_DOCUMENT,
            success: false,
            error: errorMessage,
            language
          };
          debugLog('error', '❌ 복사할 파일 없음 (다국어)', errorResult);
          return errorResult;
        }
        
        const previewMessage = language === 'ko' ?
          `${targetFiles.length}개 파일을 "${targetPath}" 경로로 복사합니다.` :
          `Copying ${targetFiles.length} file(s) to "${targetPath}" path.`;
        
        const result = {
          type: COMMAND_TYPES.COPY_DOCUMENT,
          documents: targetFiles,
          targetPath: targetPath,
          previewAction: previewMessage,
          success: true,
          language,
          operation: {
            type: OPERATION_TYPES.COPY,
            targets: targetFiles,
            destination: targetPath,
            requiresConfirmation: true
          },
          riskLevel: RISK_LEVELS.LOW,
          requiresConfirmation: true
        };
        
        debugLog('stage', '✅ 복사 명령 처리 완료 (다국어)', result);
        return result;
      }
      
      case COMMAND_TYPES.DELETE_DOCUMENT: {
        const targetFiles = localExtractors.getTargetFiles(message, selectedFiles, files);
        
        if (targetFiles.length === 0) {
          const errorMessage = language === 'ko' ? 
            '삭제할 파일을 찾을 수 없습니다. 파일을 선택하거나 파일명을 명시해주세요.' :
            'Cannot find files to delete. Please select files or specify file names.';
            
          const errorResult = {
            type: COMMAND_TYPES.DELETE_DOCUMENT,
            success: false,
            error: errorMessage,
            language
          };
          debugLog('error', '❌ 삭제할 파일 없음 (다국어)', errorResult);
          return errorResult;
        }
        
        const previewMessage = language === 'ko' ?
          `${targetFiles.length}개 파일을 삭제합니다.` :
          `Deleting ${targetFiles.length} file(s).`;
        
        const result = {
          type: COMMAND_TYPES.DELETE_DOCUMENT,
          documents: targetFiles,
          previewAction: previewMessage,
          success: true,
          language,
          operation: {
            type: OPERATION_TYPES.DELETE,
            targets: targetFiles,
            requiresConfirmation: true
          },
          riskLevel: RISK_LEVELS.HIGH,
          requiresConfirmation: true
        };
        
        debugLog('stage', '✅ 삭제 명령 처리 완료 (다국어)', result);
        return result;
      }
      
      default:
        const unknownMessage = language === 'ko' ? 
          '인식할 수 없는 명령입니다. "도움말"을 입력하여 사용 가능한 명령어를 확인해주세요.' :
          'Unrecognized command. Type "help" to see available commands.';
          
        const unknownResult = {
          type: COMMAND_TYPES.UNKNOWN,
          success: false,
          error: unknownMessage,
          language
        };
        debugLog('stage', '❌ 알 수 없는 명령 (다국어)', unknownResult);
        return unknownResult;
    }
  },
  
  // 기존 findDocuments 함수 유지 (호환성)
  findDocuments: function(query, files) {
    debugLog('stage', '⚠️ findDocuments 호출됨 (사용되지 않음)', { query, fileCount: files.length });
    
    const results = files.filter(file => 
      file.name.toLowerCase().includes(query.toLowerCase())
    );
    
    return results;
  }
};