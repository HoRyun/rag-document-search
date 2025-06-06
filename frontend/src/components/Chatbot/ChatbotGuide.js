import React from 'react';
import './ChatbotGuide.css';

const ChatbotGuide = ({ onClose, onTryExample }) => {
  const examples = [
    {
      category: '파일 검색',
      commands: [
        '분기별 보고서 파일을 찾아줘',
        '마케팅 폴더에 있는 제안서 어디 있어?',
        '사진 파일들 검색해줘',
        '가장 최근에 수정한 파일은 어디에 있어?'
      ]
    },
    {
      category: '파일 이동',
      commands: [
        '분기별 보고서를 재무 폴더로 이동해줘',
        '이 파일을 프로젝트 폴더로 옮겨',
        '선택한 문서들을 아카이브 폴더로 이동',
        '사진 파일들을 이미지 폴더로 옮겨줘'
      ]
    },
    {
      category: '파일 복사',
      commands: [
        '제안서를 마케팅 폴더에 복사해줘',
        '이 문서의 사본을 만들어줘',
        '선택한 파일들을 백업 폴더에 복사',
        '이 스프레드시트를 재무 폴더에 복제해줘'
      ]
    },
    {
      category: '파일 삭제',
      commands: [
        '이전 버전 파일을 삭제해줘',
        '임시 파일들 모두 지워줘',
        '더 이상 필요없는 보고서 삭제',
        '중복된 문서 파일 제거해줘'
      ]
    },
    {
      category: '폴더 생성',
      commands: [
        '새 프로젝트 폴더 만들어줘',
        '아카이브 폴더 생성해줘',
        '재무 폴더 안에 2024년 폴더 만들어줘',
        '클라이언트 이름으로 새 폴더 만들기'
      ]
    },
    {
      category: '문서 요약',
      commands: [
        '이 보고서 요약해줘',
        '긴 문서 내용 정리해줘',
        '제안서 핵심 내용만 뽑아줘',
        '회의록 주요 내용 요약해서 저장해줘'
      ]
    }
  ];

  return (
    <div className="chatbot-guide">
      <div className="guide-header">
        <h2>문서 도우미 사용 가이드</h2>
        <button className="close-guide-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="guide-content">
        <p className="guide-intro">
          문서 도우미는 자연어 명령으로 파일과 폴더를 관리할 수 있게 도와줍니다.
          아래 예시 명령어를 참고하여 효율적으로 문서를 관리해보세요!
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
                      시도해보기
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="guide-tips">
          <h3>유용한 팁</h3>
          <ul>
            <li>파일명을 구체적으로 언급하면 더 정확한 결과를 얻을 수 있습니다.</li>
            <li>여러 파일을 한번에 처리하려면 "모든", "전체", "이 폴더의" 등의 표현을 사용하세요.</li>
            <li>명령을 실행하기 전에 항상 미리보기를 확인하세요.</li>
            <li>문서에 대한 질문도 할 수 있습니다. 예: "마케팅 전략에 대한 내용이 담긴 문서는?"</li>
          </ul>
        </div>
      </div>
      
      <div className="guide-footer">
        <button className="close-btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
};

export default ChatbotGuide;