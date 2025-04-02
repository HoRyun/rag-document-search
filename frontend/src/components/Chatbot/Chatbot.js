import React, { useState } from 'react';
import './Chatbot.css';

const Chatbot = ({ isOpen, toggleChatbot }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: 'Hi, ~~', sender: 'bot' },
    { id: 2, text: '~~찾아줘', sender: 'user' },
    { id: 3, text: '~~여기있네요~~', sender: 'bot' },
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;
    
    // Add user message
    const userMessage = {
      id: messages.length + 1,
      text: newMessage,
      sender: 'user'
    };
    
    setMessages([...messages, userMessage]);
    setNewMessage('');
    
    // Simulate bot response (in a real app, this would be an API call)
    setTimeout(() => {
      const botMessage = {
        id: messages.length + 2,
        text: '파일을 찾아드릴게요!',
        sender: 'bot'
      };
      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  return (
    <>
      {isOpen ? (
        <div className="chatbot-container open">
          <div className="chatbot-header">
            <h3>Chatbot</h3>
            <button className="close-btn" onClick={toggleChatbot}>×</button>
          </div>
          <div className="chatbot-messages">
            {messages.map(message => (
              <div 
                key={message.id} 
                className={`message ${message.sender === 'bot' ? 'bot' : 'user'}`}
              >
                {message.text}
              </div>
            ))}
          </div>
          <form className="chatbot-input" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Type your message..."
              value={newMessage}
              onChange={handleInputChange}
            />
            <button type="submit">Send</button>
          </form>
        </div>
      ) : (
        <button className="chatbot-toggle" onClick={toggleChatbot}>
          chatbot
        </button>
      )}
    </>
  );
};

export default Chatbot;