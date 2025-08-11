import React from 'react';
import './App.css';
// import KeywordAnalyzer from './components/KeywordAnalyzer';
// import AstAnalyzer from './components/AstAnalyzer';

import AiAssistant from './components/AiAssistant';
import SourceExtractor from './components/SourceExtractor';

/**
 * 이제 App 컴포넌트는 전체 레이아웃과 주요 기능 컴포넌트들을
 * 렌더링하는 역할만 담당합니다.
 */
function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>소스 코드 분석 및 추출 도구</h1>

        {/* 키워드 기반 분석기 컴포넌트 */}
        <SourceExtractor />

        {/* AST 기반 분석기 컴포넌트 */}
        <AiAssistant />

      </header>
    </div>
  );
}

export default App;
