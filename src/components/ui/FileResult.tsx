// src/components/ui/FileResult.tsx (최종 수정본)

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import CodeBlock from "./CodeBlock";

interface FileResultProps {
    fileName: string;
    content: string;
}

const FileResult: React.FC<FileResultProps> = ({ fileName, content }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="file-result-container">
            <div
                className={`file-header ${isOpen ? "is-open" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="toggle-arrow">▶</span>
                <span className="file-name">{fileName}</span>
            </div>
            {isOpen && (
                <div className="file-content">
                    <ReactMarkdown
                        components={{
                            // ✨ 이 부분을 수정합니다.
                            code({ className, children, ...props }) {
                                // className에서 언어 정보를 추출합니다. (예: "language-js")
                                const match = /language-(\w+)/.exec(className || "");

                                // match가 성공하면 코드 블록으로, 실패하면 인라인 코드로 처리합니다.
                                return match ? (
                                    <CodeBlock
                                        language={match[1]}
                                        code={String(children).replace(/\n$/, "")}
                                    />
                                ) : (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
};

export default FileResult;