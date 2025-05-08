// 챗봇이 텍스트 명령을 이해하고 처리하기 위한 유틸리티

// 명령어 유형 정의
export const COMMAND_TYPES = {
    DOCUMENT_SEARCH: 'DOCUMENT_SEARCH',
    MOVE_DOCUMENT: 'MOVE_DOCUMENT',
    COPY_DOCUMENT: 'COPY_DOCUMENT',
    DELETE_DOCUMENT: 'DELETE_DOCUMENT',
    CREATE_FOLDER: 'CREATE_FOLDER',
    SUMMARIZE_DOCUMENT: 'SUMMARIZE_DOCUMENT',
    UNKNOWN: 'UNKNOWN'
  };
  
  // 간단한 자연어 처리를 위한 패턴 매칭
  const PATTERNS = {
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
    ]
  };
  
  // 파일 이름, 경로 등 정보를 텍스트에서 추출하는 함수들
  const extractors = {
    // 메시지에서 파일명 추출 시도
    extractFileName: (message) => {
      // 따옴표로 둘러싸인 텍스트 찾기
      const quotedMatch = message.match(/"([^"]+)"|'([^']+)'/);
      if (quotedMatch) {
        return quotedMatch[1] || quotedMatch[2];
      }
      
      // 파일 확장자를 포함하는 단어 찾기
      const extensionMatch = message.match(/\b[\w\s-]+\.(pdf|docx?|xlsx?|pptx?|txt|jpg|png|hwp|zip)\b/i);
      if (extensionMatch) {
        return extensionMatch[0];
      }
      
      // "파일", "문서" 다음에 나오는 단어 찾기
      const fileWordMatch = message.match(/(파일|문서|보고서|이미지)\s+["']?([^"'.,]+)["']?/i);
      if (fileWordMatch) {
        return fileWordMatch[2];
      }
      
      return null;
    },
    
    // 메시지에서 경로 추출 시도
    extractPath: (message) => {
      // "~/경로" 형태
      const homeMatch = message.match(/~\/([^\s"']+)/);
      if (homeMatch) {
        return `/${homeMatch[1]}`;
      }
      
      // "/경로" 형태
      const rootMatch = message.match(/\/([^\s"']+)/);
      if (rootMatch) {
        return `/${rootMatch[1]}`;
      }
      
      // "경로에", "폴더에" 등의 표현 뒤의 단어
      const locationMatch = message.match(/(경로|폴더|디렉토리|위치)(에|로|의|으로)\s+["']?([^"'.,]+)["']?/i);
      if (locationMatch) {
        return `/${locationMatch[3]}`;
      }
      
      // 직관적으로 폴더명으로 보이는 단어들 추출
      const commonFolders = ['문서', '사진', '다운로드', '음악', '비디오', '프로젝트', '재무', '마케팅', '인사', '개인'];
      for (const folder of commonFolders) {
        if (message.includes(folder)) {
          return `/${folder}`;
        }
      }
      
      return null;
    },
    
    // 메시지에서 새 폴더명 추출 시도
    extractNewFolderName: (message) => {
      // "폴더명" 형태로 명시된 경우
      const folderNameMatch = message.match(/폴더명\s*[:|=]?\s*["']?([^"'.,]+)["']?/i);
      if (folderNameMatch) {
        return folderNameMatch[1];
      }
      
      // "이름을/으로 ~" 형태
      const nameAsMatch = message.match(/이름(을|을로|으로|은|은로)\s*["']?([^"'.,]+)["']?/i);
      if (nameAsMatch) {
        return nameAsMatch[2];
      }
      
      // "~ 폴더 만들기" 형태에서 앞의 단어
      const createMatch = message.match(/["']?([^"'.,]+)["']?\s*폴더(\s*를|\s*을)?\s*(만들|생성|추가)/i);
      if (createMatch) {
        return createMatch[1];
      }
      
      return null;
    }
  };
  
  // 명령 처리 헬퍼 함수
  export const CommandProcessor = {
    // 메시지에서 명령을 분석하고 결과 반환
    processMessage: (message, files = [], directories = []) => {
      const lowerMsg = message.toLowerCase();
      let commandType = COMMAND_TYPES.UNKNOWN;
      
      // 패턴 매칭을 통한 명령 타입 파악
      if (PATTERNS.SEARCH.some(pattern => pattern.test(lowerMsg))) {
        commandType = COMMAND_TYPES.DOCUMENT_SEARCH;
      } else if (PATTERNS.MOVE.some(pattern => pattern.test(lowerMsg))) {
        commandType = COMMAND_TYPES.MOVE_DOCUMENT;
      } else if (PATTERNS.COPY.some(pattern => pattern.test(lowerMsg))) {
        commandType = COMMAND_TYPES.COPY_DOCUMENT;
      } else if (PATTERNS.DELETE.some(pattern => pattern.test(lowerMsg))) {
        commandType = COMMAND_TYPES.DELETE_DOCUMENT;
      } else if (PATTERNS.CREATE_FOLDER.some(pattern => pattern.test(lowerMsg))) {
        commandType = COMMAND_TYPES.CREATE_FOLDER;
      } else if (PATTERNS.SUMMARIZE.some(pattern => pattern.test(lowerMsg))) {
        commandType = COMMAND_TYPES.SUMMARIZE_DOCUMENT;
      }
      
      // 분석된 명령 타입에 따라 추가 정보 추출 및 결과 생성
      switch (commandType) {
        case COMMAND_TYPES.DOCUMENT_SEARCH: {
          // 검색어 추출 (실제 검색 로직은 구현되지 않음)
          // 파일명, 확장자, 또는 내용 키워드 추출
          const fileName = extractors.extractFileName(message);
          const searchTerm = fileName || message.replace(/찾아|검색|어디에|있어|있나|위치|경로/g, '').trim();
          
          // 실제 검색을 하지 않고 가상의 결과 반환
          const searchResults = files
            .filter(file => {
              if (!searchTerm) return false;
              return file.name.toLowerCase().includes(searchTerm.toLowerCase());
            })
            .slice(0, 5); // 최대 5개만 반환
          
          if (searchResults.length === 0 && files.length > 0) {
            // 매칭되는 결과가 없으면 예시로 몇 개만 보여줌
            searchResults.push(...files.slice(0, 3));
          }
          
          return {
            type: COMMAND_TYPES.DOCUMENT_SEARCH,
            query: searchTerm,
            results: searchResults,
            success: true
          };
        }
        
        case COMMAND_TYPES.MOVE_DOCUMENT: {
          // 파일명과 대상 경로 추출
          const fileName = extractors.extractFileName(message);
          const targetPath = extractors.extractPath(message) || '/';
          
          // 파일명으로 파일 찾기
          let fileToMove = null;
          if (fileName) {
            fileToMove = files.find(file => 
              file.name.toLowerCase().includes(fileName.toLowerCase())
            );
          } else if (files.length > 0) {
            // 파일명이 명시적으로 없으면 첫 번째 파일 사용 (예시 목적)
            fileToMove = files[0];
          }
          
          if (!fileToMove) {
            return {
              type: COMMAND_TYPES.MOVE_DOCUMENT,
              success: false,
              error: '이동할 파일을 찾을 수 없습니다.'
            };
          }
          
          return {
            type: COMMAND_TYPES.MOVE_DOCUMENT,
            document: fileToMove,
            targetPath: targetPath,
            previewAction: `"${fileToMove.name}" 문서를 "${targetPath}" 경로로 이동합니다.`,
            success: true
          };
        }
        
        case COMMAND_TYPES.COPY_DOCUMENT: {
          // 파일명과 대상 경로 추출
          const fileName = extractors.extractFileName(message);
          const targetPath = extractors.extractPath(message) || '/';
          
          // 파일명으로 파일 찾기
          let fileToCopy = null;
          if (fileName) {
            fileToCopy = files.find(file => 
              file.name.toLowerCase().includes(fileName.toLowerCase())
            );
          } else if (files.length > 0) {
            // 파일명이 명시적으로 없으면 첫 번째 파일 사용 (예시 목적)
            fileToCopy = files[0];
          }
          
          if (!fileToCopy) {
            return {
              type: COMMAND_TYPES.COPY_DOCUMENT,
              success: false,
              error: '복사할 파일을 찾을 수 없습니다.'
            };
          }
          
          return {
            type: COMMAND_TYPES.COPY_DOCUMENT,
            document: fileToCopy,
            targetPath: targetPath,
            previewAction: `"${fileToCopy.name}" 문서를 "${targetPath}" 경로로 복사합니다.`,
            success: true
          };
        }
        
        case COMMAND_TYPES.DELETE_DOCUMENT: {
          // 삭제할 파일명 추출
          const fileName = extractors.extractFileName(message);
          
          // 파일명으로 파일 찾기
          let fileToDelete = null;
          if (fileName) {
            fileToDelete = files.find(file => 
              file.name.toLowerCase().includes(fileName.toLowerCase())
            );
          } else if (files.length > 0) {
            // 파일명이 명시적으로 없으면 첫 번째 파일 사용 (예시 목적)
            fileToDelete = files[0];
          }
          
          if (!fileToDelete) {
            return {
              type: COMMAND_TYPES.DELETE_DOCUMENT,
              success: false,
              error: '삭제할 파일을 찾을 수 없습니다.'
            };
          }
          
          return {
            type: COMMAND_TYPES.DELETE_DOCUMENT,
            document: fileToDelete,
            previewAction: `"${fileToDelete.name}" 문서를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`,
            success: true
          };
        }
        
        case COMMAND_TYPES.CREATE_FOLDER: {
          // 새 폴더명과 생성 위치 추출
          const folderName = extractors.extractNewFolderName(message) || '새 폴더';
          const parentPath = extractors.extractPath(message) || '/';
          
          return {
            type: COMMAND_TYPES.CREATE_FOLDER,
            folderName: folderName,
            parentPath: parentPath,
            previewAction: `"${parentPath}" 경로에 "${folderName}" 폴더를 생성합니다.`,
            success: true
          };
        }
        
        case COMMAND_TYPES.SUMMARIZE_DOCUMENT: {
          // 요약할 파일명 추출
          const fileName = extractors.extractFileName(message);
          
          // 파일명으로 파일 찾기
          let fileToSummarize = null;
          if (fileName) {
            fileToSummarize = files.find(file => 
              file.name.toLowerCase().includes(fileName.toLowerCase())
            );
          } else if (files.length > 0) {
            // 파일명이 명시적으로 없으면 첫 번째 파일 사용 (예시 목적)
            fileToSummarize = files[0];
          }
          
          if (!fileToSummarize) {
            return {
              type: COMMAND_TYPES.SUMMARIZE_DOCUMENT,
              success: false,
              error: '요약할 파일을 찾을 수 없습니다.'
            };
          }
          
          // 가상의 요약 내용 생성 (실제로는 백엔드에서 처리)
          const mockSummary = `이 문서는 "${fileToSummarize.name}"에 대한 가상 요약입니다. 실제 요약은 백엔드에서 처리될 예정입니다. 문서 요약은 주요 내용, 핵심 포인트, 결론 등을 추출하여 원본 문서의 주요 정보를 짧게 정리한 내용을 제공합니다.`;
          
          return {
            type: COMMAND_TYPES.SUMMARIZE_DOCUMENT,
            document: fileToSummarize,
            summary: mockSummary,
            previewAction: `"${fileToSummarize.name}" 문서의 요약본을 생성했습니다.`,
            success: true
          };
        }
        
        default:
          return {
            type: COMMAND_TYPES.UNKNOWN,
            success: false,
            error: '인식할 수 없는 명령입니다.'
          };
      }
    },
    
    // 파일 검색 결과를 생성하는 헬퍼 함수 (실제 구현에서는 백엔드 API 호출)
    findDocuments: (query, files) => {
      // 간단한 문자열 매칭으로 검색
      const results = files.filter(file => 
        file.name.toLowerCase().includes(query.toLowerCase())
      );
      
      return results;
    }
  };