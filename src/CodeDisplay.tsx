import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CodeDisplay.css';

// 컴포넌트에 전달될 데이터의 타입을 정의합니다.
interface CodeSnippet {
  lang: string;
  code: string;
}

// 컴포넌트의 props 타입을 정의합니다.
interface CodeDisplayProps {
  snippets: CodeSnippet[];
}

const CodeDisplay: React.FC<CodeDisplayProps> = ({ snippets }) => {
  // ------------------ [수정된 부분] ------------------
  // 1. 훅(Hook) 호출을 컴포넌트 최상단으로 이동
  //    React 훅은 항상 모든 조건문이나 리턴문보다 먼저 호출되어야 합니다.
  const [activeTab, setActiveTab] = useState<number>(0);

  // 2. 조건부 리턴은 훅 호출 다음에 위치
  if (!snippets || snippets.length === 0) {
    return null;
  }
  // ----------------------------------------------------

  return (
    <div className="code-display-container">
      {/* 탭 버튼 영역 */}
      <div className="tabs">
        {snippets.map((snippet, index) => (
          <button
            key={index}
            className={`tab-button ${index === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {snippet.lang}
          </button>
        ))}
      </div>

      {/* 코드 콘텐츠 영역 */}
      <div className="code-content">
        <SyntaxHighlighter
          language={snippets[activeTab].lang.toLowerCase()}
          style={atomDark}
          showLineNumbers
        >
          {String(snippets[activeTab].code)}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default CodeDisplay;