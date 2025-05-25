// ===== 개선된 Chatbot.js (기존 구조 유지하며 기능 추가) =====

import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';
import ChatbotGuide from './ChatbotGuide';

// 새로 추가할 서비스들
import { CommandProcessor, OPERATION_TYPES, RISK_LEVELS } from './CommandProcessor';

// 새로 추가할 컴포넌트
import OperationPreviewModal from './OperationPreviewModal';

const Chatbot = ({ 
  isOpen, 
  toggleChatbot, 
  onQuery, 
  isQuerying,
  // 새로 추가되는 props들 (기존 App.js에서 전달)
  files = [],
  directories = [],
  selectedItems = [],
  currentPath = '/',
  onRefreshFiles,
  onShowNotification
}) => {
  const [messages, setMessages] = useState([
    { id: 1, text: '안녕하세요! 파일 관리 도우미입니다. 파일 검색, 이동, 복사, 삭제 등 다양한 작업을 도와드릴 수 있습니다. 명령어 예시가 필요하시면 "도움말"이라고 입력해보세요.', sender: 'bot' },
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  
  // ===== 새로 추가되는 상태들 =====
  const [currentOperation, setCurrentOperation] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [recentOperations, setRecentOperations] = useState([]);
  
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
  
  // 메시지 추가 헬퍼 함수 (새로 추가)
  const addMessage = (text, sender = 'bot', data = null) => {
    const newMsg = {
      id: Date.now(),
      text,
      sender,
      timestamp: new Date(),
      data
    };
    setMessages(prev => [...prev, newMsg]);
    return newMsg;
  };
  
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
  };
  
  // ===== 개선된 handleSubmit 함수 =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || isQuerying || isProcessingCommand) return;
    
    // 사용자 메시지 추가
    addMessage(newMessage, 'user');
    const userCommand = newMessage;
    setNewMessage('');
    
    // 도움말 명령어 처리 (기존 로직 유지)
    if (userCommand.toLowerCase().includes('도움말') || 
        userCommand.toLowerCase().includes('도와줘') || 
        userCommand.toLowerCase().includes('명령어') || 
        userCommand.toLowerCase().includes('사용법')) {
      setShowGuide(true);
      addMessage('명령어 가이드를 표시합니다. 여기서 다양한 명령어 예시를 확인하실 수 있습니다.');
      return;
    }
    
    // ===== 새로운 자연어 명령 처리 로직 =====
    setIsProcessingCommand(true);
    
    try {
      // 컨텍스트 정보 준비
      const context = {
        currentPath,
        selectedFiles: selectedItems.map(id => files.find(f => f.id === id)).filter(Boolean),
        availableFolders: directories,
        allFiles: files
      };
      
      // 1단계: 명령 분석 시도
      let analysisResult;
      try {
        analysisResult = await CommandProcessor.analyzeCommand(userCommand, context);
      } catch (error) {
        // 명령 분석 실패 시 null로 설정
        analysisResult = { success: false };
      }
      
      if (analysisResult && analysisResult.success) {
        // ===== 자연어 명령으로 인식된 경우 =====
        let responseText = '명령을 처리합니다.';
        
        switch (analysisResult.operation?.type) {
          case OPERATION_TYPES.MOVE:
            responseText = `파일을 "${analysisResult.operation.destination}" 경로로 이동하시겠습니까?`;
            break;
          case OPERATION_TYPES.COPY:
            responseText = `파일을 "${analysisResult.operation.destination}" 경로로 복사하시겠습니까?`;
            break;
          case OPERATION_TYPES.DELETE:
            responseText = `선택한 파일을 삭제하시겠습니까?`;
            break;
          case OPERATION_TYPES.CREATE_FOLDER:
            responseText = `"${analysisResult.operation.folderName}" 폴더를 생성하시겠습니까?`;
            break;
          case OPERATION_TYPES.SEARCH:
            responseText = `"${analysisResult.operation.searchTerm}"에 대한 검색 결과입니다.`;
            break;
          case OPERATION_TYPES.RENAME:
            responseText = `파일 이름을 "${analysisResult.operation.newName}"으로 변경하시겠습니까?`;
            break;
          default:
            responseText = '명령을 처리합니다.';
            break;
        }
        
        addMessage(responseText);
        
        // 확인이 필요한 작업인 경우 미리보기 모달 표시
        if (analysisResult.requiresConfirmation) {
          setCurrentOperation(analysisResult);
          setShowPreviewModal(true);
        } else {
          // 확인이 필요없는 작업은 바로 실행 (예: 검색)
          await executeOperation(analysisResult.operationId, {});
        }
        
      } else {
        // ===== 일반 RAG 질의로 처리 (기존 로직 유지) =====
        const typingMessage = {
          id: 'typing',
          text: '검색 중...',
          sender: 'bot',
          isTyping: true
        };
        
        setMessages(prev => [...prev, typingMessage]);
        
        try {
          const answer = await onQuery(userCommand);
          
          // 'typing' 메시지 제거
          setMessages(prev => prev.filter(msg => msg.id !== 'typing'));
          
          // 봇 응답 추가
          addMessage(answer || '죄송합니다, 답변을 찾을 수 없습니다.');
          
        } catch (error) {
          // 오류 처리
          setMessages(prev => prev.filter(msg => msg.id !== 'typing'));
          addMessage('죄송합니다, 오류가 발생했습니다.');
        }
      }
      
    } catch (error) {
      console.error('명령 처리 중 오류:', error);
      addMessage('명령 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessingCommand(false);
    }
  };
  
  // ===== 새로 추가되는 작업 실행 함수들 =====
  
  const executeOperation = async (operationId, userOptions = {}) => {
    try {
      setIsProcessingCommand(true);
      
      const executionResult = await CommandProcessor.executeOperation(operationId, userOptions);
      
      if (executionResult.success) {
        const result = executionResult.result;
        
        // 성공 메시지 추가
        addMessage(result.message || '작업이 성공적으로 완료되었습니다.', 'bot', {
          operationId,
          canUndo: result.undoAvailable,
          undoDeadline: result.undoDeadline
        });

        // 실행된 작업 기록
        setRecentOperations(prev => [
          {
            id: operationId,
            timestamp: new Date(),
            canUndo: result.undoAvailable,
            undoDeadline: result.undoDeadline,
            description: result.message
          },
          ...prev.slice(0, 4) // 최근 5개만 유지
        ]);

        // FileDisplay 새로고침
        if (onRefreshFiles) {
          onRefreshFiles();
        }

        // 성공 알림
        if (onShowNotification) {
          onShowNotification(result.message || '작업이 완료되었습니다.');
        }

        // 되돌리기 가능한 작업의 경우 안내 메시지
        if (result.undoAvailable) {
          setTimeout(() => {
            addMessage(
              `💡 이 작업은 ${new Date(result.undoDeadline).toLocaleTimeString()}까지 되돌릴 수 있습니다. "방금 작업 되돌리기"라고 말씀해보세요.`, 
              'bot'
            );
          }, 1000);
        }

      } else {
        addMessage(`작업 실행 실패: ${executionResult.error}`);
      }

    } catch (error) {
      console.error('작업 실행 오류:', error);
      addMessage('작업 실행 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // 미리보기 모달 확인
  const handlePreviewConfirm = async (userOptions) => {
    if (!currentOperation) return;

    setShowPreviewModal(false);
    addMessage('작업을 실행합니다...');

    await executeOperation(currentOperation.operationId, userOptions);
    setCurrentOperation(null);
  };

  // 미리보기 모달 취소
  const handlePreviewCancel = async () => {
    if (!currentOperation) return;

    try {
      await CommandProcessor.cancelOperation(currentOperation.operationId);
      addMessage('작업이 취소되었습니다.');
    } catch (error) {
      addMessage('작업 취소 중 오류가 발생했습니다.');
    } finally {
      setShowPreviewModal(false);
      setCurrentOperation(null);
    }
  };

  // 작업 되돌리기
  const handleUndoOperation = async (operationId) => {
    try {
      setIsProcessingCommand(true);
      addMessage('작업을 되돌리고 있습니다...');

      const undoResult = await CommandProcessor.undoOperation(operationId, '사용자 요청');

      if (undoResult.success) {
        addMessage('작업이 성공적으로 되돌려졌습니다.');
        
        // 되돌린 작업을 기록에서 제거
        setRecentOperations(prev => prev.filter(op => op.id !== operationId));
        
        // FileDisplay 새로고침
        if (onRefreshFiles) {
          onRefreshFiles();
        }
      } else {
        addMessage(`작업 되돌리기 실패: ${undoResult.error}`);
      }

    } catch (error) {
      console.error('작업 되돌리기 오류:', error);
      addMessage('작업 되돌리기 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingCommand(false);
    }
  };
  
  // ===== 기존 가이드 관련 함수들 유지 =====
  
  const handleGuideClose = () => {
    setShowGuide(false);
  };
  
  const handleTryExample = (exampleCommand) => {
    setNewMessage(exampleCommand);
    setShowGuide(false);
  };

  // ===== 메시지 렌더링 (되돌리기 버튼 포함) =====
  const renderMessage = (message) => {
    return (
      <div key={message.id} className={`message ${message.sender === 'bot' ? 'bot' : 'user'} ${message.isTyping ? 'typing' : ''}`}>
        <div className="message-content">{message.text}</div>
        {message.timestamp && (
          <div className="message-timestamp">
            {message.timestamp.toLocaleTimeString()}
          </div>
        )}
        
        {/* 되돌리기 가능한 작업에 대한 버튼 */}
        {message.data?.canUndo && new Date() < new Date(message.data.undoDeadline) && (
          <button 
            className="undo-btn"
            onClick={() => handleUndoOperation(message.data.operationId)}
            disabled={isProcessingCommand}
          >
            작업 되돌리기
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="chatbot-wrapper">
      {/* 명령어 가이드 (기존 로직 유지) */}
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
            <h3>🤖 스마트 파일 관리 도우미</h3>
            <div className="header-status">
              {selectedItems.length > 0 && (
                <span className="selected-count">{selectedItems.length}개 선택됨</span>
              )}
            </div>
            <button className="close-btn" onClick={toggleChatbot}>×</button>
          </div>
          
          <div className="chatbot-messages">
            {messages.map(renderMessage)}
            {(isQuerying || isProcessingCommand) && (
              <div className="message bot typing">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="chatbot-input" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="파일 작업을 자연어로 명령하거나 문서에 대해 질문해보세요..."
              value={newMessage}
              onChange={handleInputChange}
              disabled={isQuerying || isProcessingCommand}
            />
            <button 
              type="submit" 
              disabled={newMessage.trim() === '' || isQuerying || isProcessingCommand}
              className={(isQuerying || isProcessingCommand) ? 'loading' : ''}
            >
              {(isQuerying || isProcessingCommand) ? '처리 중...' : '전송'}
            </button>
          </form>

          {/* 최근 작업 되돌리기 패널 */}
          {recentOperations.filter(op => op.canUndo && new Date() < new Date(op.undoDeadline)).length > 0 && (
            <div className="recent-operations">
              <h4>되돌리기 가능한 작업:</h4>
              {recentOperations
                .filter(op => op.canUndo && new Date() < new Date(op.undoDeadline))
                .map(operation => (
                  <div key={operation.id} className="undo-item">
                    <span className="operation-desc">{operation.description}</span>
                    <button 
                      className="undo-btn-small"
                      onClick={() => handleUndoOperation(operation.id)}
                      disabled={isProcessingCommand}
                    >
                      되돌리기
                    </button>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      ) : (
        <button className="chatbot-toggle" onClick={toggleChatbot}>
          🤖 파일 도우미
        </button>
      )}

      {/* 작업 미리보기 모달 */}
      <OperationPreviewModal
        operationData={currentOperation}
        onConfirm={handlePreviewConfirm}
        onCancel={handlePreviewCancel}
        onClose={() => setShowPreviewModal(false)}
        isVisible={showPreviewModal}
      />
    </div>
  );
};

export default Chatbot;