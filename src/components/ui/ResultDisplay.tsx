import React from 'react';
// react-icons 라이브러리에서 다운로드 아이콘을 가져옵니다.
import { FiDownload } from 'react-icons/fi';

interface ResultDisplayProps {
    isLoading: boolean;
    statusMessage: string;
    extractionResult: string;
    onSaveToFile: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ isLoading, statusMessage, extractionResult, onSaveToFile }) => {
    
    // 로딩 중이 아니고, 결과값도 없으면 아무것도 표시하지 않습니다.
    if (!isLoading && !extractionResult) {
        return null;
    }

    // [수정] 겹치는 헤더(.result-header)를 제거하고 구조를 단순화합니다.
    return (
        <div className="result-display-wrapper">
            {/* 실제 결과가 표시되는 내용 부분 */}
            <div className="result-content">
                {/* 로딩 중일 때 상태 메시지를 표시합니다. */}
                {isLoading && (
                    <p className="status-message">{statusMessage || '분석을 준비 중입니다...'}</p>
                )}
                {/* 로딩이 아니고 결과가 있을 때, 결과를 <pre> 태그로 감싸서 표시합니다. */}
                {!isLoading && extractionResult && (
                    <pre>{extractionResult}</pre>
                )}
            </div>

            {/* 저장 버튼을 결과 내용 위에 배치합니다. */}
            {extractionResult && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    <button onClick={onSaveToFile} className="btn-save-result">
                        <FiDownload />
                        <span>결과 저장 (.md)</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ResultDisplay;
