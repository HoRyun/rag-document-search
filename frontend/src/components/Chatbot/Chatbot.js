// ===== 다국어 지원 강화된 Chatbot.js =====

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import './Chatbot.css';
import ChatbotGuide from './ChatbotGuide';

// 새로 추가할 서비스들
import { CommandProcessor, OPERATION_TYPES } from './CommandProcessor';

// 새로 추가할 컴포넌트
import OperationPreviewModal from './OperationPreviewModal';

const Chatbot = ({ 
  isOpen, 
  toggleChatbot, 
  onQuery, 
  isQuerying,
  // 기존 App.js에서 전달받는 props들
  files = [],
  directories = [],
  selectedItems = [],
  currentPath = '/',
  onRefreshFiles,
  onShowNotification
}) => {
  const { t, currentLanguage } = useTranslation();
  
  const [messages, setMessages] = useState([]);
  
  const [newMessage, setNewMessage] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  
  // 작업 관련 상태들
  const [currentOperation, setCurrentOperation] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [recentOperations, setRecentOperations] = useState([]);
  
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    setMessages([
      { id: 1, text: t('chatbot.welcome'), sender: 'bot' }
    ]);
  }, [t]);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length > 0 && prev[0].sender === 'bot' && prev[0].id === 1) {
        const newMessages = [...prev];
        newMessages[0] = { 
          ...newMessages[0], 
          text: t('chatbot.welcome') 
        };
        return newMessages;
      }
      return prev;
    });
  }, [currentLanguage, t]);
  
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
  
  // 메시지 추가 헬퍼 함수
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

  // 백엔드 응답에 따른 메시지 생성 함수 (다국어 지원)
  const generateResponseText = (analysisResult, context) => {
    const { operation } = analysisResult;
    const { selectedFiles } = context;
    
    // 선택된 파일이 있을 때 더 구체적인 응답
    if (selectedFiles.length > 0) {
      const fileNames = selectedFiles.map(f => f.name).join(', ');
      
      switch (operation?.type) {
        case OPERATION_TYPES.MOVE:
          return t('chatbot.operations.confirmMove', { 
            files: fileNames, 
            destination: operation.destination 
          });
        case OPERATION_TYPES.COPY:
          return t('chatbot.operations.confirmCopy', { 
            files: fileNames, 
            destination: operation.destination 
          });
        case OPERATION_TYPES.DELETE:
          return t('chatbot.operations.confirmDelete', { files: fileNames });
        case OPERATION_TYPES.RENAME:
          return t('chatbot.operations.confirmRename', { 
            files: fileNames, 
            newName: operation.newName 
          });
        case OPERATION_TYPES.SUMMARIZE:
          return t('chatbot.operations.confirmSummarize', { count: selectedFiles.length });
        default:
          return t('chatbot.operations.confirmGeneric', { count: selectedFiles.length });
      }
    } else {
      // 선택된 파일이 없을 때 기본 응답
      switch (operation?.type) {
        case OPERATION_TYPES.CREATE_FOLDER:
          return t('chatbot.operations.confirmCreateFolder', { 
            path: context.currentPath, 
            name: operation.folderName 
          });
        case OPERATION_TYPES.SEARCH:
          return t('chatbot.operations.searchResults', { term: operation.searchTerm });
        case OPERATION_TYPES.MOVE:
          return t('chatbot.operations.confirmMoveGeneric', { destination: operation.destination });
        case OPERATION_TYPES.COPY:
          return t('chatbot.operations.confirmCopyGeneric', { destination: operation.destination });
        case OPERATION_TYPES.DELETE:
          return t('chatbot.operations.confirmDeleteGeneric');
        case OPERATION_TYPES.RENAME:
          return t('chatbot.operations.confirmRenameGeneric', { newName: operation.newName });
        default:
          return t('chatbot.operations.processing');
      }
    }
  };
  
  // 수정된 handleSubmit 함수 (언어 정보 포함)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || isQuerying || isProcessingCommand) return;
    
    // 사용자 메시지 추가
    addMessage(newMessage, 'user');
    const userCommand = newMessage;
    setNewMessage('');
    
    // 도움말 명령어 처리 (다국어 지원)
    const helpKeywords = {
      ko: ['도움말', '도와줘', '명령어', '사용법', 'help'],
      en: ['help', 'guide', 'commands', 'usage', 'how to']
    };
    
    const currentHelpKeywords = helpKeywords[currentLanguage] || helpKeywords.ko;
    const isHelpCommand = currentHelpKeywords.some(keyword => 
      userCommand.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isHelpCommand) {
      setShowGuide(true);
      addMessage(t('chatbot.guide.showMessage'));
      return;
    }
    
    setIsProcessingCommand(true);
    
    try {
      // 개선된 컨텍스트 정보 준비 (언어 정보 포함)
      const context = {
        currentPath,
        selectedFiles: selectedItems.map(id => files.find(f => f.id === id)).filter(Boolean),
        availableFolders: directories,
        allFiles: files,
        language: currentLanguage // 언어 정보 추가
      };

      // 디버깅 로그
      console.log('=== Chatbot 다국어 컨텍스트 정보 ===');
      console.log('현재 언어:', currentLanguage);
      console.log('현재 경로:', currentPath);
      console.log('선택된 파일 ID들:', selectedItems);
      console.log('선택된 파일 객체들:', context.selectedFiles);
      console.log('사용자 명령:', userCommand);
      console.log('=============================');
      
      // 백엔드 요청 시도
      let analysisResult;
      const useBackendFallback = process.env.REACT_APP_USE_BACKEND_FALLBACK === 'true';
      
      try {
        // CommandProcessor에 언어 정보도 함께 전달
        analysisResult = await CommandProcessor.analyzeCommand(userCommand, context);
        
        if (analysisResult && analysisResult.success) {
          console.log('✅ 백엔드 처리 성공 (언어:', currentLanguage, ')');
          
          let responseText = generateResponseText(analysisResult, context);
          addMessage(responseText);
          
          if (analysisResult.requiresConfirmation) {
            setCurrentOperation(analysisResult);
            setShowPreviewModal(true);
          } else {
            if (analysisResult.operationId) {
              await executeOperation(analysisResult.operationId, {});
            } else {
              if (analysisResult.type === 'DOCUMENT_SEARCH') {
                if (analysisResult.results && analysisResult.results.length > 0) {
                  const resultText = t('chatbot.operations.searchResultsList', { 
                    count: analysisResult.results.length,
                    results: analysisResult.results.map(file => `• ${file.name}`).join('\n')
                  });
                  addMessage(resultText);
                } else {
                  addMessage(t('chatbot.operations.noSearchResults'));
                }
              }
            }
          }
          
          return;
        }
      } catch (error) {
        console.error('❌ 백엔드 요청 실패:', error);
        
        if (useBackendFallback) {
          console.log('🔄 로컬 폴백 처리 시작');
          
          try {
            analysisResult = CommandProcessor.processMessage(userCommand, files, directories, context);
            
            if (analysisResult && analysisResult.success) {
              console.log('✅ 로컬 폴백 처리 성공');
              
              let responseText = generateResponseText(analysisResult, context);
              addMessage(responseText + ' ' + t('chatbot.operations.localProcessing'));
              
              if (analysisResult.requiresConfirmation) {
                analysisResult.isLocalFallback = true;
                setCurrentOperation(analysisResult);
                setShowPreviewModal(true);
              } else {
                if (analysisResult.type === 'DOCUMENT_SEARCH') {
                  if (analysisResult.results && analysisResult.results.length > 0) {
                    const resultText = t('chatbot.operations.searchResultsList', { 
                      count: analysisResult.results.length,
                      results: analysisResult.results.map(file => `• ${file.name}`).join('\n')
                    });
                    addMessage(resultText);
                  } else {
                    addMessage(t('chatbot.operations.noSearchResults'));
                  }
                }
              }
              
              return;
            }
          } catch (fallbackError) {
            console.error('❌ 로컬 폴백도 실패:', fallbackError);
          }
        }
        
        // 상태 확인 명령 처리 (다국어 지원)
        const statusKeywords = {
          ko: ['상태', '현재', '선택된'],
          en: ['status', 'current', 'selected']
        };
        
        const currentStatusKeywords = statusKeywords[currentLanguage] || statusKeywords.ko;
        const isStatusCommand = currentStatusKeywords.some(keyword => 
          userCommand.toLowerCase().includes(keyword.toLowerCase())
        ) && !userCommand.toLowerCase().includes(currentLanguage === 'ko' ? '이동' : 'move');
        
        if (isStatusCommand) {
          const statusMessage = t('chatbot.status.current') + '\n' +
            t('chatbot.status.path') + ': ' + currentPath + '\n' +
            t('chatbot.status.totalFiles') + ': ' + files.length + '\n' +
            t('chatbot.status.selectedFiles') + ': ' + selectedItems.length +
            (selectedItems.length > 0 ? '\n\n' + t('chatbot.status.selectedList') + '\n' +
              selectedItems.map(id => {
                const file = files.find(f => f.id === id);
                return file ? `• ${file.name}` : `• [ID:${id}]`;
              }).join('\n') : '');
          
          addMessage(statusMessage.trim());
          return;
        }
        
        // RAG 질의로 처리 (언어 정보 포함)
        console.log('🔄 RAG 질의로 폴백 처리 (언어:', currentLanguage, ')');
        
        const typingMessage = {
          id: 'typing',
          text: t('chatbot.searching'),
          sender: 'bot',
          isTyping: true
        };
        
        setMessages(prev => [...prev, typingMessage]);
        
        try {
          // onQuery에 언어 정보도 함께 전달
          const answer = await onQuery(userCommand, currentLanguage);
          
          setMessages(prev => prev.filter(msg => msg.id !== 'typing'));
          addMessage(answer || t('chatbot.noAnswerFound'));
          
        } catch (ragError) {
          setMessages(prev => prev.filter(msg => msg.id !== 'typing'));
          addMessage(t('chatbot.operations.failed'));
        }
      }
      
    } catch (error) {
      console.error('명령 처리 중 오류:', error);
      addMessage(t('chatbot.operations.failed'));
    } finally {
      setIsProcessingCommand(false);
    }
  };
  
  // 작업 실행 함수 (다국어 지원)
  const executeOperation = async (operationId, userOptions = {}) => {
    try {
      setIsProcessingCommand(true);
      
      const executionResult = await CommandProcessor.executeOperation(operationId, userOptions);
      
      if (executionResult.success) {
        const result = executionResult.result;
        
        addMessage(result.message || t('chatbot.operations.completed'), 'bot', {
          operationId,
          canUndo: result.undoAvailable,
          undoDeadline: result.undoDeadline
        });

        setRecentOperations(prev => [
          {
            id: operationId,
            timestamp: new Date(),
            canUndo: result.undoAvailable,
            undoDeadline: result.undoDeadline,
            description: result.message
          },
          ...prev.slice(0, 4)
        ]);

        if (onRefreshFiles) {
          onRefreshFiles();
        }

        if (onShowNotification) {
          onShowNotification(result.message || t('chatbot.operations.completed'));
        }

        if (result.undoAvailable) {
          setTimeout(() => {
            addMessage(t('chatbot.operations.undoAvailable', { 
              time: new Date(result.undoDeadline).toLocaleTimeString() 
            }), 'bot');
          }, 1000);
        }

      } else {
        addMessage(t('chatbot.operations.executionFailed', { error: executionResult.error }));
      }

    } catch (error) {
      console.error('작업 실행 오류:', error);
      addMessage(t('chatbot.operations.failed'));
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // 미리보기 모달 확인 (다국어 지원)
  const handlePreviewConfirm = async (userOptions) => {
    if (!currentOperation) return;

    setShowPreviewModal(false);
    addMessage(t('chatbot.operations.executing'));

    if (currentOperation.operationId) {
      await executeOperation(currentOperation.operationId, userOptions);
    } else if (currentOperation.isLocalFallback) {
      try {
        await handleLocalOperation(currentOperation, userOptions);
      } catch (error) {
        console.error('로컬 작업 실행 오류:', error);
        addMessage(t('chatbot.operations.failed'));
      }
    } else {
      try {
        await handleLocalOperation(currentOperation, userOptions);
      } catch (error) {
        console.error('로컬 작업 실행 오류:', error);
        addMessage(t('chatbot.operations.failed'));
      }
    }
    
    setCurrentOperation(null);
  };

  // 로컬 작업 처리 함수 (다국어 지원)
  const handleLocalOperation = async (operation, userOptions) => {
    const { operation: op } = operation;
    
    switch (op?.type) {
      case OPERATION_TYPES.MOVE:
        addMessage(t('chatbot.operations.localMoveCompleted', { 
          count: op.targets.length, 
          destination: op.destination 
        }));
        break;
      case OPERATION_TYPES.COPY:
        addMessage(t('chatbot.operations.localCopyCompleted', { 
          count: op.targets.length, 
          destination: op.destination 
        }));
        break;
      case OPERATION_TYPES.DELETE:
        addMessage(t('chatbot.operations.localDeleteCompleted', { count: op.targets.length }));
        break;
      default:
        addMessage(t('chatbot.operations.localCompleted', { action: operation.previewAction }));
    }
    
    if (onRefreshFiles) {
      onRefreshFiles();
    }
    
    if (onShowNotification) {
      onShowNotification(t('chatbot.operations.localProcessingComplete'));
    }
  };

  // 미리보기 모달 취소 (다국어 지원)
  const handlePreviewCancel = async () => {
    if (!currentOperation) return;

    try {
      if (currentOperation.operationId) {
        await CommandProcessor.cancelOperation(currentOperation.operationId);
      }
      addMessage(t('chatbot.operations.cancelled'));
    } catch (error) {
      addMessage(t('chatbot.operations.cancelFailed'));
    } finally {
      setShowPreviewModal(false);
      setCurrentOperation(null);
    }
  };

  // 작업 되돌리기 (다국어 지원)
  const handleUndoOperation = async (operationId) => {
    try {
      setIsProcessingCommand(true);
      addMessage(t('chatbot.operations.undoing'));

      const undoResult = await CommandProcessor.undoOperation(operationId, t('chatbot.operations.userRequest'));

      if (undoResult.success) {
        addMessage(t('chatbot.operations.undoSuccess'));
        
        setRecentOperations(prev => prev.filter(op => op.id !== operationId));
        
        if (onRefreshFiles) {
          onRefreshFiles();
        }
      } else {
        addMessage(t('chatbot.operations.undoFailed', { error: undoResult.error }));
      }

    } catch (error) {
      console.error('작업 되돌리기 오류:', error);
      addMessage(t('chatbot.operations.undoFailed', { error: error.message }));
    } finally {
      setIsProcessingCommand(false);
    }
  };
  
  // 가이드 관련 함수들
  const handleGuideClose = () => {
    setShowGuide(false);
  };
  
  const handleTryExample = (exampleCommand) => {
    setNewMessage(exampleCommand);
    setShowGuide(false);
  };

  // 메시지 렌더링 (되돌리기 버튼 포함)
  const renderMessage = (message) => {
    return (
      <div key={message.id} className={`message ${message.sender === 'bot' ? 'bot' : 'user'} ${message.isTyping ? 'typing' : ''}`}>
        <div className="message-content">{message.text}</div>
        {message.timestamp && (
          <div className="message-timestamp">
            {message.timestamp.toLocaleTimeString()}
          </div>
        )}
        
        {message.data?.canUndo && new Date() < new Date(message.data.undoDeadline) && (
          <button 
            className="undo-btn"
            onClick={() => handleUndoOperation(message.data.operationId)}
            disabled={isProcessingCommand}
          >
            {t('chatbot.operations.undo')}
          </button>
        )}
      </div>
    );
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
            <h3>🤖 {t('chatbot.title')}</h3>
            <div className="header-status">
              {selectedItems.length > 0 && (
                <span className="selected-count">
                  {t('chatbot.status.selectedCount', { count: selectedItems.length })}
                </span>
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
              placeholder={t('chatbot.placeholder')}
              value={newMessage}
              onChange={handleInputChange}
              disabled={isQuerying || isProcessingCommand}
            />
            <button 
              type="submit" 
              disabled={newMessage.trim() === '' || isQuerying || isProcessingCommand}
              className={(isQuerying || isProcessingCommand) ? 'loading' : ''}
            >
              {(isQuerying || isProcessingCommand) ? t('chatbot.sending') : t('chatbot.send')}
            </button>
          </form>

          {/* 최근 작업 되돌리기 패널 */}
          {recentOperations.filter(op => op.canUndo && new Date() < new Date(op.undoDeadline)).length > 0 && (
            <div className="recent-operations">
              <h4>{t('chatbot.operations.undoRecent')}</h4>
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
                      {t('chatbot.operations.undo')}
                    </button>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      ) : (
        <button className="chatbot-toggle" onClick={toggleChatbot}>
          🤖 {t('chatbot.toggle')}
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