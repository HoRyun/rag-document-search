import React from 'react';
import './ThemeToggle.css';

const ThemeToggle = ({ isDarkMode, onToggle }) => {
  return (
    <div className="theme-toggle-container">
      <input
        type="checkbox"
        id="theme-toggle"
        className="theme-toggle-checkbox"
        checked={isDarkMode}
        onChange={onToggle}
      />
      <label htmlFor="theme-toggle" className="theme-toggle-label">
        <span className="theme-toggle-inner"></span>
        <span className="theme-toggle-switch"></span>
      </label>
    </div>
  );
};

export default ThemeToggle;