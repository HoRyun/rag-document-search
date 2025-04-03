import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';

const Chatbot = ({ isOpen, toggleChatbot, onQuery, isQuerying }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: '안녕하세요! 파일 관리 도우미입니다. 무엇을 도와드릴까요?', sender: 'bot' },
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  
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
    setNewMessage('');
    
    // 'bot is typing' 메시지 추가
    const typingMessage = {
      id: 'typing',
      text: '검색 중...',
      sender: 'bot',
      isTyping: true
    };
    
    setMessages(prev => [...prev, typingMessage]);
    
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
  };

  return (
    <>
      {isOpen ? (
        <div className="chatbot-container open">
          <div className="chatbot-header">
            <h3>문서 검색 도우미</h3>
            <button className="close-btn" onClick={toggleChatbot}>×</button>
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
              placeholder="질문을 입력하세요..."
              value={newMessage}
              onChange={handleInputChange}
              disabled={isQuerying}
            />
            <button 
              type="submit" 
              disabled={newMessage.trim() === '' || isQuerying}
              className={isQuerying ? 'loading' : ''}
            >
              {isQuerying ? '검색 중...' : '검색'}
            </button>
          </form>
        </div>
      ) : (
        <button className="chatbot-toggle" onClick={toggleChatbot}>
          문서 검색
        </button>
      )}
    </>
  );
};

export default Chatbot;