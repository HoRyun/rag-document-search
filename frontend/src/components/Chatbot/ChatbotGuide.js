import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import './ChatbotGuide.css';

const ChatbotGuide = ({ onClose, onTryExample }) => {
  const { t, currentLanguage } = useTranslation();
  
  // 언어별 예시 명령어들
  const examples = currentLanguage === 'ko' ? [
    {
      category: t('chatbot.guide.categories.search'),
      commands: [
        '분기별 보고서 파일을 찾아줘',
        '마케팅 폴더에 있는 제안서 어디 있어?',
        '사진 파일들 검색해줘',
        '가장 최근에 수정한 파일은 어디에 있어?'
      ]
    },
    {
      category: t('chatbot.guide.categories.move'),
      commands: [
        '분기별 보고서를 재무 폴더로 이동해줘',
        '이 파일을 프로젝트 폴더로 옮겨',
        '선택한 문서들을 아카이브 폴더로 이동',
        '사진 파일들을 이미지 폴더로 옮겨줘'
      ]
    },
    {
      category: t('chatbot.guide.categories.copy'),
      commands: [
        '제안서를 마케팅 폴더에 복사해줘',
        '이 문서의 사본을 만들어줘',
        '선택한 파일들을 백업 폴더에 복사',
        '이 스프레드시트를 재무 폴더에 복제해줘'
      ]
    },
    {
      category: t('chatbot.guide.categories.delete'),
      commands: [
        '이전 버전 파일을 삭제해줘',
        '임시 파일들 모두 지워줘',
        '더 이상 필요없는 보고서 삭제',
        '중복된 문서 파일 제거해줘'
      ]
    },
    {
      category: t('chatbot.guide.categories.createFolder'),
      commands: [
        '새 프로젝트 폴더 만들어줘',
        '아카이브 폴더 생성해줘',
        '재무 폴더 안에 2024년 폴더 만들어줘',
        '클라이언트 이름으로 새 폴더 만들기'
      ]
    },
    {
      category: t('chatbot.guide.categories.summarize'),
      commands: [
        '이 보고서 요약해줘',
        '긴 문서 내용 정리해줘',
        '제안서 핵심 내용만 뽑아줘',
        '회의록 주요 내용 요약해서 저장해줘'
      ]
    }
  ] : [
    {
      category: t('chatbot.guide.categories.search'),
      commands: [
        'Find quarterly report files',
        'Where is the proposal in the marketing folder?',
        'Search for photo files',
        'Where is the most recently modified file?'
      ]
    },
    {
      category: t('chatbot.guide.categories.move'),
      commands: [
        'Move quarterly report to finance folder',
        'Move this file to project folder',
        'Move selected documents to archive folder',
        'Move photo files to images folder'
      ]
    },
    {
      category: t('chatbot.guide.categories.copy'),
      commands: [
        'Copy proposal to marketing folder',
        'Make a copy of this document',
        'Copy selected files to backup folder',
        'Clone this spreadsheet to finance folder'
      ]
    },
    {
      category: t('chatbot.guide.categories.delete'),
      commands: [
        'Delete previous version files',
        'Delete all temporary files',
        'Delete unnecessary reports',
        'Remove duplicate document files'
      ]
    },
    {
      category: t('chatbot.guide.categories.createFolder'),
      commands: [
        'Create new project folder',
        'Create archive folder',
        'Create 2024 folder in finance folder',
        'Create new folder with client name'
      ]
    },
    {
      category: t('chatbot.guide.categories.summarize'),
      commands: [
        'Summarize this report',
        'Organize long document content',
        'Extract key points from proposal',
        'Summarize and save meeting minutes'
      ]
    }
  ];

  return (
    <div className="chatbot-guide">
      <div className="guide-header">
        <h2>{t('chatbot.guide.title')}</h2>
        <button className="close-guide-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="guide-content">
        <p className="guide-intro">
          {t('chatbot.guide.intro')}
        </p>
        
        <div className="command-examples">
          {examples.map((category, idx) => (
            <div className="category-section" key={idx}>
              <h3>{category.category}</h3>
              <ul>
                {category.commands.map((command, cmdIdx) => (
                  <li key={cmdIdx}>
                    <span className="command-text">{command}</span>
                    <button 
                      className="try-btn" 
                      onClick={() => onTryExample(command)}
                    >
                      {t('chatbot.guide.tryExample')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="guide-tips">
          <h3>{t('chatbot.guide.tips.title')}</h3>
          <ul>
            {t('chatbot.guide.tips.items').map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="guide-footer">
        <button className="close-btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
};

export default ChatbotGuide;