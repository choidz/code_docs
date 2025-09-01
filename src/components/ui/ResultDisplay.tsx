import React, { useMemo } from "react";
import { useAnalysisStore } from "../../store/analysisStore";
import FileResult from "./FileResult";
import CodeBlock from "./CodeBlock";

interface ResultDisplayProps {
  onSaveToFile: () => void;
}

// 컴포넌트 외부로 순수 함수를 분리하여 불필요한 재선언 방지
const parseResultByFile = (result: string) => {
  const fileSections = result.split("## 📄 소스: ").filter((s) => s.trim());
  return fileSections.map((section) => {
    const firstLineEnd = section.indexOf("\n");
    const fileName = section.substring(0, firstLineEnd).trim();
    const content = section.substring(firstLineEnd + 1);
    return { fileName, content };
  });
};

const ResultDisplay: React.FC<ResultDisplayProps> = ({ onSaveToFile }) => {
  // ✨ Zustand 스토어에서 직접 상태를 가져옵니다 (props 대신).
  const isLoading = useAnalysisStore((state) => state.isLoading);
  const statusMessage = useAnalysisStore((state) => state.statusMessage);
  const extractionResult = useAnalysisStore((state) => state.extractionResult);

  // ✨ useMemo를 사용하여 extractionResult가 변경될 때만 파싱을 다시 실행합니다.
  const fileResults = useMemo(() => {
    if (!extractionResult) return [];
    // "## 📄 소스: " 마커가 있을 때만 파일별로 파싱합니다.
    if (extractionResult.includes("## 📄 소스: ")) {
      return parseResultByFile(extractionResult);
    }
    return []; // 그룹화할 수 없는 경우는 빈 배열 반환
  }, [extractionResult]);

  return (
    <div className="output-section">
      <h2>분석 결과</h2>
      {isLoading && <p>{statusMessage || "분석 중..."}</p>}

      {extractionResult && !isLoading && (
        <div className="result-container">
          <div className="result-header">
            <button onClick={onSaveToFile} className="save-markdown-button">
              💾 결과 저장하기 (.md)
            </button>
          </div>
          <div className="result-body">
            {fileResults.length > 0 ? (
              // 그룹화된 결과가 있으면 FileResult 컴포넌트로 렌더링
              fileResults.map(({ fileName, content }, index) => (
                <FileResult key={index} fileName={fileName} content={content} />
              ))
            ) : (
              // 그룹화할 수 없는 단일 결과는 CodeBlock으로 렌더링
              <CodeBlock language="markdown" code={extractionResult} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;