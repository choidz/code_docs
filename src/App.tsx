// 파일 경로: src/App.js

import { useEffect, useState } from 'react'; // useEffect import
import './App.css';

import AiAssistant from './components/AiAssistant';
import SourceExtractor from './components/SourceExtractor';

// 아이콘 추가 (Sun, Moon)
import { FaCode } from 'react-icons/fa';
import { FiCpu, FiMoon, FiSun } from 'react-icons/fi';

type ActiveView = 'extractor' | 'assistant';
type Theme = 'light' | 'dark';

// ▼▼▼ [추가] 테마 토글 버튼 컴포넌트 ▼▼▼
const ThemeToggle = ({ theme, setTheme }: { theme: Theme, setTheme: (theme: Theme) => void }) => {
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <button className="theme-toggle" onClick={toggleTheme}>
      {theme === 'light' ? <FiMoon /> : <FiSun />}
      <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
    </button>
  );
};


function App() {
  const [activeView, setActiveView] = useState<ActiveView>('extractor');

  // ▼▼▼ [추가] 테마 상태 관리 로직 ▼▼▼
  const [theme, setTheme] = useState<Theme>('light'); // 기본값 light

  // 1. 앱이 처음 로드될 때 localStorage에서 저장된 테마를 확인
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // 2. theme 상태가 변경될 때마다 <html> 태그의 클래스를 바꾸고 localStorage에 저장
  useEffect(() => {
    document.body.className = theme + '-mode';
    localStorage.setItem('theme', theme);
  }, [theme]);
  // ▲▲▲ 여기까지 추가 ▲▲▲

  return (
    <div className="app-layout">
      <nav className="sidebar">
        {/* 상단 메뉴 그룹 */}
        <div> 
          <div className="sidebar-header">
            <h1>소스추출기</h1>
          </div>

          {/* [변경] Felix 스타일의 메인 액션 버튼 추가 */}
          <div className="sidebar-action">
            <button className="btn-primary-solid">
              + 새 분석 시작
            </button>
          </div>

          {/* [변경] 메뉴 목록 위에 타이틀 추가 */}
          <div className="sidebar-menu-title">Menu</div>
          <ul className="sidebar-menu">
           <li
            className={activeView === 'extractor' ? 'active' : ''}
            onClick={() => setActiveView('extractor')}
          >
            <FaCode />
            <span>소스 코드 추출기</span>
          </li>
          <li
            className={activeView === 'assistant' ? 'active' : ''}
            onClick={() => setActiveView('assistant')}
          >
            <FiCpu /> 
            <span>AI 어시스턴트</span>
          </li>
          </ul>
        </div>

        {/* 하단 푸터 그룹 (테마 토글 등) */}
        <div className="sidebar-footer">
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </nav>

      <main className="main-content">
        {activeView === 'extractor' && <SourceExtractor />}
        {activeView === 'assistant' && <AiAssistant />}
      </main>
    </div>
  );
}

export default App;