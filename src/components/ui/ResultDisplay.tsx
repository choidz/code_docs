import React, { useEffect, useRef, useState } from "react";

// window 객체에 highlight.js (hljs)가 존재함을 TypeScript에 알려줍니다.
declare global {
  interface Window {
    hljs: any;
  }
}

// ==========================================================
// 1. 코드 블록 UI를 담당하는 재사용 가능한 컴포넌트 (기존과 동일)
// ==========================================================
interface CodeBlockProps {
  code: string;
  language: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const codeRef = useRef<HTMLElement>(null);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(code)
      .then(() => alert("코드가 클립보드에 복사되었습니다!"))
      .catch((err) => console.error("클립보드 복사 실패:", err));
  };

  useEffect(() => {
    if (codeRef.current && window.hljs) {
      window.hljs.highlightElement(codeRef.current);
    }
  }, [code]);

  return (
    <div className='code-block-container'>
      <pre>
        <code ref={codeRef} className={`language-${language}`}>
          {code}
        </code>
      </pre>
      <button onClick={handleCopy} className='copy-button'>
        Copy
      </button>
    </div>
  );
};

// ==========================================================
// 2. [신규] 개별 파일 결과를 표시하는 폴딩(접고 펴기) 컴포넌트
// ==========================================================
interface FileResultProps {
  fileName: string;
  content: string;
}

const FileResult: React.FC<FileResultProps> = ({ fileName, content }) => {
  // 각 파일 섹션이 열려있는지 여부를 관리하는 상태
  const [isOpen, setIsOpen] = useState(true);

  // 일반 텍스트와 코드 블록을 파싱하는 함수 (기존 로직과 동일)
  const parseContentToComponents = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      const codeBlockMatch = part.match(/```(\w+)?\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        const language = codeBlockMatch[1] || "plaintext";
        const code = codeBlockMatch[2];
        return <CodeBlock key={index} language={language} code={code} />;
      } else {
        return part.trim() ? (
          <pre key={index} className='text-block'>
            {part}
          </pre>
        ) : null;
      }
    });
  };

  return (
    <div className='file-result-container'>
      {/* 파일 이름을 표시하고 클릭 이벤트를 처리하는 헤더 */}
      <div
        className={`file-header ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}>
        <span className='toggle-arrow'>▶</span>
        <span className='file-name'>{fileName}</span>
      </div>
      {/* isOpen 상태일 때만 내용을 렌더링 */}
      {isOpen && (
        <div className='file-content'>{parseContentToComponents(content)}</div>
      )}
    </div>
  );
};

// ==========================================================
// 3. 새로운 구조의 메인 ResultDisplay 컴포넌트
// ==========================================================
interface ResultDisplayProps {
  isLoading: boolean;
  statusMessage: string;
  extractionResult: string;
  onSaveToFile: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  isLoading,
  statusMessage,
  extractionResult,
  onSaveToFile,
}) => {
  /**
   * 전체 분석 결과 문자열을 파일별로 그룹화하여 객체 배열로 파싱합니다.
   */
  const parseResultByFile = (result: string) => {
    // "## 📄 소스: "를 기준으로 전체 결과를 파일별 섹션으로 나눕니다.
    const fileSections = result.split("## 📄 소스: ").filter((s) => s.trim());

    return fileSections.map((section) => {
      // 각 섹션의 첫 줄에서 파일 이름을 추출합니다.
      const firstLineEnd = section.indexOf("\n");
      const fileName = section.substring(0, firstLineEnd).trim();
      const content = section.substring(firstLineEnd + 1);
      return { fileName, content };
    });
  };

  const fileResults = extractionResult
    ? parseResultByFile(extractionResult)
    : [];

  return (
    <div className='output-section'>
      <h2>분석 결과</h2>
      {isLoading && <p>{statusMessage || "분석 중..."}</p>}

      {extractionResult && (
        <div className='result-container'>
          <div className='result-header'>
            <button onClick={onSaveToFile} className='save-markdown-button'>
              💾 결과 저장하기 (.md)
            </button>
          </div>
          <div className='result-body'>
            {/* 파싱된 파일 결과들을 FileResult 컴포넌트로 렌더링합니다. */}
            {fileResults.length > 0 ? (
              fileResults.map(({ fileName, content }, index) => (
                <FileResult key={index} fileName={fileName} content={content} />
              ))
            ) : (
              // 단일 파일 분석 등 그룹화할 수 없는 경우, 기존 방식으로 표시
              <pre className='text-block'>{extractionResult}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
