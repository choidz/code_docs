import React, { useEffect, useRef } from 'react';
// highlight.js를 사용하기 위해 window 객체에 타입 선언
declare global {
    interface Window { hljs: any; }
}

// ==========================================================
// 1. 코드 블록을 렌더링하는 자식 컴포넌트
// ==========================================================
interface CodeBlockProps {
    code: string;
    language: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
    const codeRef = useRef<HTMLElement>(null);

    // 복사 버튼 클릭 시 클립보드에 코드 저장
    const handleCopy = () => {
        navigator.clipboard.writeText(code)
            .then(() => alert('코드가 클립보드에 복사되었습니다!'))
            .catch(err => console.error('클립보드 복사 실패:', err));
    };

    // 코드가 변경될 때마다 highlight.js를 실행하여 구문 강조 적용
    useEffect(() => {
        if (codeRef.current && window.hljs) {
            window.hljs.highlightElement(codeRef.current);
        }
    }, [code]);

    return (
        <div className="code-block-container">
            <pre>
                <code ref={codeRef} className={`language-${language}`}>
                    {code}
                </code>
            </pre>
            <button onClick={handleCopy} className="copy-button">Copy</button>
        </div>
    );
};


// ==========================================================
// 2. 메인 ResultDisplay 컴포넌트
// ==========================================================
interface ResultDisplayProps {
    isLoading: boolean;
    statusMessage: string;
    extractionResult: string;
    onSaveToFile: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ isLoading, statusMessage, extractionResult, onSaveToFile }) => {
    
    // Markdown 문자열을 파싱하여 일반 텍스트와 코드 블록으로 분리
    const parseResult = (result: string) => {
        const parts = result.split(/(```[\s\S]*?```)/g);
        return parts.map((part, index) => {
            const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
            if (match) {
                const language = match[1] || 'plaintext';
                const code = match[2];
                return <CodeBlock key={index} language={language} code={code} />;
            } else {
                // 일반 텍스트는 pre 태그로 감싸서 공백과 줄바꿈을 유지
                return part.trim() ? <pre key={index} className="text-block">{part}</pre> : null;
            }
        });
    };

    return (
        <div className="output-section">
            <h2>분석 결과</h2>
            {isLoading && <p>{statusMessage || '분석 중...'}</p>}
            
            {extractionResult && (
                <div className="result-container">
                    <div className="result-header">
                        <button onClick={onSaveToFile} className="save-markdown-button">
                            💾 결과 저장하기 (.md)
                        </button>
                    </div>
                    <div className="result-body">
                        {parseResult(extractionResult)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultDisplay;
