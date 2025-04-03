import React from 'react';
import './Header.css';

const Header = ({ onLogout, username }) => {
  return (
    <header className="header">
      <div className="logo">
        <h1>FileManager</h1>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Search files..." />
      </div>
      <div className="user-actions">
        <span className="username">{username ? `${username}님` : ''}</span>
        <button className="menu-btn">Menu</button>
        <button className="user-btn">User</button>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
};

export default Header;