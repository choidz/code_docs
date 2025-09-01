import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
    code: string;
    language: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
    const handleCopy = () => {
        navigator.clipboard
            .writeText(code)
            .then(() => alert("코드가 클립보드에 복사되었습니다!"))
            .catch((err) => console.error("클립보드 복사 실패:", err));
    };

    return (
        <div className="code-block-container">
            <SyntaxHighlighter language={language} style={vscDarkPlus} showLineNumbers>
                {code}
            </SyntaxHighlighter>
            <button onClick={handleCopy} className="copy-button">
                Copy
            </button>
        </div>
    );
};

export default CodeBlock;