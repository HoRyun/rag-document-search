import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';
import ChatbotGuide from './ChatbotGuide';

// CommandProcessor 임포트
import { CommandProcessor, COMMAND_TYPES } from './CommandProcessor';

// 명령 결과를 UI에 표시하기 위한 컴포넌트
const CommandResultView = ({ result, onConfirm, onCancel }) => {
  if (!result) return null;
  
  switch (result.type) {
    case 'DOCUMENT_SEARCH':
      return (
        <div className="command-result document-search">
          <h3>검색 결과: "{result.query}"</h3>
          <div className="result-list">
            {result.results.map((doc) => (
              <div key={doc.id} className="document-item">
                <div className="document-icon"></div>
                <div className="document-info">
                  <div className="document-name">{doc.name}</div>
                  <div className="document-path">{doc.path}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="action-buttons">
            <button className="action-btn" onClick={onConfirm}>
              확인
            </button>
          </div>
        </div>
      );
      
    case 'MOVE_DOCUMENT':
    case 'COPY_DOCUMENT':
    case 'DELETE_DOCUMENT':
    case 'CREATE_FOLDER':
      return (
        <div className="command-result action-preview">
          <h3>작업 확인</h3>
          <div className="preview-message">
            {result.previewAction}
          </div>
          <div className="action-illustration">
            {result.type === 'MOVE_DOCUMENT' && (
              <div className="move-illustration">
                <div className="source-path">{result.document.path}</div>
                <div className="arrow">→</div>
                <div className="target-path">{result.targetPath}</div>
              </div>
            )}
            {result.type === 'COPY_DOCUMENT' && (
              <div className="copy-illustration">
                <div className="source-path">{result.document.path}</div>
                <div className="arrow">⟹</div>
                <div className="target-path">{result.targetPath}</div>
              </div>
            )}
            {result.type === 'CREATE_FOLDER' && (
              <div className="folder-illustration">
                <div className="parent-path">{result.parentPath}</div>
                <div className="new-folder">
                  <div className="folder-icon"></div>
                  <div>{result.folderName}</div>
                </div>
              </div>
            )}
          </div>
          <div className="action-buttons">
            <button className="cancel-btn" onClick={onCancel}>
              취소
            </button>
            <button className="confirm-btn" onClick={onConfirm}>
              확인
            </button>
          </div>
        </div>
      );
      
    case 'SUMMARIZE_DOCUMENT':
      return (
        <div className="command-result summarize-result">
          <h3>문서 요약: {result.document.name}</h3>
          <div className="summary-content">
            {result.summary}
          </div>
          <div className="save-options">
            <h4>요약본 저장</h4>
            <div className="option">
              <input type="radio" id="save-with-original" name="save-option" defaultChecked />
              <label htmlFor="save-with-original">원본 문서와 같은 위치에 저장</label>
            </div>
            <div className="option">
              <input type="radio" id="save-custom" name="save-option" />
              <label htmlFor="save-custom">다른 위치에 저장</label>
            </div>
            <div className="option">
              <input type="checkbox" id="replace-if-exists" />
              <label htmlFor="replace-if-exists">같은 이름의 파일이 있으면 대체</label>
            </div>
          </div>
          <div className="action-buttons">
            <button className="cancel-btn" onClick={onCancel}>
              취소
            </button>
            <button className="confirm-btn" onClick={onConfirm}>
              저장
            </button>
            <button className="neutral-btn" onClick={() => onConfirm(false)}>
              저장 안 함
            </button>
          </div>
        </div>
      );
      
    default:
      return null;
  }
};

const Chatbot = ({ 
  isOpen, 
  toggleChatbot, 
  onQuery, 
  isQuerying,
  files = [],
  directories = [],
  onMoveItem,
  onCopyItem,
  onDeleteItem,
  onCreateFolder,
  onFileSummarize 
}) => {
  const [messages, setMessages] = useState([
    { id: 1, text: '안녕하세요! 파일 관리 도우미입니다. 파일 검색, 이동, 복사, 삭제 등 다양한 작업을 도와드릴 수 있습니다. 명령어 예시가 필요하시면 "도움말"이라고 입력해보세요.', sender: 'bot' },
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  const [commandResult, setCommandResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const messagesEndRef = useRef(null);
  
  // 챗봇이 닫히면 가이드도 함께 닫기
  useEffect(() => {
    if (!isOpen) {
      setShowGuide(false);
    }
  }, [isOpen]);
  
  // 메시지 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || isQuerying) return;
    
    // 사용자 메시지 추가
    const userMessage = {
      id: messages.length + 1,
      text: newMessage,
      sender: 'user'
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // 도움말 명령어 처리
    if (newMessage.toLowerCase().includes('도움말') || 
        newMessage.toLowerCase().includes('도와줘') || 
        newMessage.toLowerCase().includes('명령어') || 
        newMessage.toLowerCase().includes('사용법')) {
      // 도움말 보여주기
      setShowGuide(true);
      setNewMessage('');
      
      // 봇 응답 추가
      const botMessage = {
        id: messages.length + 2,
        text: '명령어 가이드를 표시합니다. 여기서 다양한 명령어 예시를 확인하실 수 있습니다.',
        sender: 'bot'
      };
      
      setMessages(prev => [...prev, botMessage]);
      return;
    }
    
    // 명령어 처리 시도
    const commandResult = CommandProcessor.processMessage(newMessage, files, directories);
    
    if (commandResult && commandResult.success) {
      // 봇 응답 메시지 추가
      let responseText = '명령을 처리합니다.';
      
      switch (commandResult.type) {
        case COMMAND_TYPES.DOCUMENT_SEARCH:
          responseText = `"${commandResult.query}"에 대한 검색 결과를 찾았습니다.`;
          break;
        case COMMAND_TYPES.MOVE_DOCUMENT:
          responseText = `"${commandResult.document.name}" 파일을 "${commandResult.targetPath}" 경로로 이동하시겠습니까?`;
          break;
        case COMMAND_TYPES.COPY_DOCUMENT:
          responseText = `"${commandResult.document.name}" 파일을 "${commandResult.targetPath}" 경로로 복사하시겠습니까?`;
          break;
        case COMMAND_TYPES.DELETE_DOCUMENT:
          responseText = `"${commandResult.document.name}" 파일을 삭제하시겠습니까?`;
          break;
        case COMMAND_TYPES.CREATE_FOLDER:
          responseText = `"${commandResult.parentPath}" 경로에 "${commandResult.folderName}" 폴더를 생성하시겠습니까?`;
          break;
        case COMMAND_TYPES.SUMMARIZE_DOCUMENT:
          responseText = `"${commandResult.document.name}" 문서의 요약을 생성했습니다.`;
          break;
        default:
          responseText = '명령을 처리합니다.';
          break;
      }
      
      const botMessage = {
        id: messages.length + 2,
        text: responseText,
        sender: 'bot'
      };
      
      setMessages(prev => [...prev, botMessage]);
      setNewMessage('');
      
      // 명령 결과를 저장하고 모달 표시
      setCommandResult(commandResult);
      setShowResultModal(true);
    } else {
      // 'bot is typing' 메시지 추가
      const typingMessage = {
        id: 'typing',
        text: '검색 중...',
        sender: 'bot',
        isTyping: true
      };
      
      setMessages(prev => [...prev, typingMessage]);
      setNewMessage('');
      
      // RAG 질의 처리
      try {
        const answer = await onQuery(newMessage);
        
        // 'typing' 메시지 제거
        setMessages(prev => prev.filter(msg => msg.id !== 'typing'));
        
        // 봇 응답 추가
        const botMessage = {
          id: messages.length + 2,
          text: answer || '죄송합니다, 답변을 찾을 수 없습니다.',
          sender: 'bot'
        };
        
        setMessages(prev => [...prev, botMessage]);
      } catch (error) {
        // 오류 처리
        setMessages(prev => prev.filter(msg => msg.id !== 'typing'));
        
        const errorMessage = {
          id: messages.length + 2,
          text: '죄송합니다, 오류가 발생했습니다.',
          sender: 'bot'
        };
        
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };
  
  // 명령 확인 핸들러
  const handleCommandConfirm = (saveOption = true) => {
    if (!commandResult) return;
    
    // 백엔드에 실제 작업 요청 (여기서는 모의 구현)
    let successMessage = '';
    
    switch (commandResult.type) {
      case 'DOCUMENT_SEARCH':
        successMessage = '검색 결과를 확인하셨습니다.';
        break;
      case 'MOVE_DOCUMENT':
        // 실제로는 onMoveItem(commandResult.document.id, commandResult.targetPath) 호출
        successMessage = `"${commandResult.document.name}" 문서를 "${commandResult.targetPath}" 경로로 이동했습니다.`;
        break;
      case 'COPY_DOCUMENT':
        // 실제로는 onCopyItem(commandResult.document.id, commandResult.targetPath) 호출
        successMessage = `"${commandResult.document.name}" 문서를 "${commandResult.targetPath}" 경로로 복사했습니다.`;
        break;
      case 'DELETE_DOCUMENT':
        // 실제로는 onDeleteItem(commandResult.document.id) 호출
        successMessage = `"${commandResult.document.name}" 문서를 삭제했습니다.`;
        break;
      case 'CREATE_FOLDER':
        // 실제로는 onCreateFolder(commandResult.folderName, commandResult.parentPath) 호출
        successMessage = `"${commandResult.parentPath}" 경로에 "${commandResult.folderName}" 폴더를 생성했습니다.`;
        break;
      case 'SUMMARIZE_DOCUMENT':
        if (saveOption) {
          // 실제로는 요약본 저장 API 호출
          successMessage = `"${commandResult.document.name}" 문서의 요약본을 저장했습니다.`;
        } else {
          successMessage = `요약본을 저장하지 않았습니다.`;
        }
        break;
      default:
        successMessage = '작업이 완료되었습니다.';
        break;
    }
    
    // 성공 메시지 추가
    const botMessage = {
      id: messages.length + 1,
      text: successMessage,
      sender: 'bot'
    };
    
    setMessages(prev => [...prev, botMessage]);
    
    // 모달 닫기
    setShowResultModal(false);
    setCommandResult(null);
  };
  
  // 명령 취소 핸들러
  const handleCommandCancel = () => {
    if (!commandResult) return;
    
    // 취소 메시지 추가
    const cancelMessage = {
      id: messages.length + 1,
      text: '명령이 취소되었습니다.',
      sender: 'bot'
    };
    
    setMessages(prev => [...prev, cancelMessage]);
    
    // 모달 닫기
    setShowResultModal(false);
    setCommandResult(null);
  };
  
  // 가이드 닫기 핸들러
  const handleGuideClose = () => {
    setShowGuide(false);
  };
  
  // 예시 명령어 시도 핸들러
  const handleTryExample = (exampleCommand) => {
    setNewMessage(exampleCommand);
    setShowGuide(false);
  };

  // 챗봇 토글 핸들러 수정 - 가이드도 함께 제어
  const handleToggleChatbot = () => {
    // 챗봇을 끄면 가이드도 자동으로 꺼지도록 처리
    if (isOpen) {
      toggleChatbot(); // 챗봇 끄기
      // 가이드는 useEffect에서 자동으로 처리됨
    } else {
      toggleChatbot(); // 챗봇 켜기
    }
  };

  return (
    <div className="chatbot-wrapper">
      {/* 명령어 가이드 */}
      {isOpen && showGuide && (
        <div className="chatbot-guide-panel">
          <ChatbotGuide
            onClose={handleGuideClose}
            onTryExample={handleTryExample}
          />
        </div>
      )}
      
      {isOpen ? (
        <div className="enhanced-chatbot-container open">
          <div className="chatbot-header">
            <h3>문서 관리 도우미</h3>
            <button className="close-btn" onClick={handleToggleChatbot}>×</button>
          </div>
          <div className="chatbot-messages">
            {messages.map(message => (
              <div 
                key={message.id} 
                className={`message ${message.sender === 'bot' ? 'bot' : 'user'} ${message.isTyping ? 'typing' : ''}`}
              >
                {message.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form className="chatbot-input" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="명령어나 질문을 입력하세요..."
              value={newMessage}
              onChange={handleInputChange}
              disabled={isQuerying}
            />
            <button 
              type="submit" 
              disabled={newMessage.trim() === '' || isQuerying}
              className={isQuerying ? 'loading' : ''}
            >
              {isQuerying ? '처리 중...' : '전송'}
            </button>
          </form>
          
          {/* 명령 결과 모달 */}
          {showResultModal && (
            <div className="result-modal-overlay">
              <div className="result-modal">
                <CommandResultView 
                  result={commandResult}
                  onConfirm={handleCommandConfirm}
                  onCancel={handleCommandCancel}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <button className="chatbot-toggle" onClick={handleToggleChatbot}>
          문서 도우미
        </button>
      )}
    </div>
  );
};

export default Chatbot;