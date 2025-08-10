import { useState } from 'react';
import './App.css';
import CodeDisplay from './CodeDisplay';

interface DocumentedSnippet {
  lang: string;
  code: string;
}
interface ExtractedFunction {
  code: string;
  description: string;
}

const languageOptions = [
  { label: 'Flutter / Dart', value: 'dart' },
  { label: 'React / JS / TS', value: 'typescript' },
  { label: 'ExtJS / JavaScript', value: 'javascript' },
];

function App() {
  const [language, setLanguage] = useState<string>(languageOptions[0].value);
  const [rawCode, setRawCode] = useState<string>('');
  const [extractedFunctions, setExtractedFunctions] = useState<ExtractedFunction[]>([]);
  const [documentedSnippets, setDocumentedSnippets] = useState<DocumentedSnippet[]>([]);

  const handleExtractFunctions = () => {
    // --- [수정 1: 경고 해결] ---
    // 정규표현식의 끝을 나타내는 불필요한 이스케이프 문자 \Z를 $로 변경했습니다.
    const regex = /(?:\/\/|#)\s*@doc\s*\n([\s\S]*?)(?=(?:\/\/|#)\s*@doc|$)/g;

    const matches = Array.from(rawCode.matchAll(regex));
    if (matches.length === 0) {
      alert('@doc 태그가 붙은 함수나 코드 블록을 찾을 수 없습니다.');
      return;
    }
    const functions = matches.map(match => ({
      code: match[1].trim(),
      description: '',
    }));
    setExtractedFunctions(functions);
  };

  const handleDescriptionChange = (index: number, newDescription: string) => {
    // --- [수정 2: 에러 해결] ---
    // 자기 자신(updatedFunctions)이 아닌, state에 있는 'extractedFunctions'를 복사해야 합니다.
    const updatedFunctions = [...extractedFunctions];
    
    updatedFunctions[index].description = newDescription;
    setExtractedFunctions(updatedFunctions);
  };

  const handleAddToDocs = (func: ExtractedFunction) => {
    if (!func.description.trim()) {
      alert('기능 설명을 작성해주세요.');
      return;
    }
    const finalCode = `/**\n * 기능: ${func.description}\n */\n${func.code}`;
    const newSnippet: DocumentedSnippet = {
      lang: language,
      code: finalCode,
    };
    setDocumentedSnippets(prevSnippets => [...prevSnippets, newSnippet]);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>소스 코드 추출 도구</h1>
        <p>소스코드에 `@doc` 주석을 추가하여 중요한 소스를 자동으로 추출하세요.</p>
        <div className="input-form">
          <div className="form-field">
            <label htmlFor="language-select">언어</label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="language-select"
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="code-input">전체 소스 코드</label>
            <textarea id="code-input" value={rawCode} onChange={(e) => setRawCode(e.target.value)} rows={12} />
          </div>
          <button onClick={handleExtractFunctions} className="add-button">
            @doc 코드 블록 추출하기
          </button>
        </div>
        {extractedFunctions.length > 0 && (
          <div className="extracted-list">
            <h2>추출된 코드 블록 ({extractedFunctions.length}개)</h2>
            {extractedFunctions.map((func, index) => (
              <div key={index} className="extracted-item">
                <CodeDisplay snippets={[{ lang: language, code: func.code }]} />
                <textarea
                  className="description-input"
                  placeholder="이 코드 블록의 주요 기능, 역할 등을 설명하세요."
                  value={func.description}
                  onChange={(e) => handleDescriptionChange(index, e.target.value)}
                  rows={3}
                />
                <button onClick={() => handleAddToDocs(func)} className="add-to-docs-button">
                  설명과 함께 문서에 추가
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="output-section">
          {documentedSnippets.length > 0 && <h2>최종 문서</h2>}
          <CodeDisplay snippets={documentedSnippets} />
        </div>
      </header>
    </div>
  );
}

export default App;