import React from 'react';
import FormField from './FormField';

// 1. 부모로부터 받을 props 타입에 statusMessage 추가
interface ResultDisplayProps {
    isLoading: boolean;
    statusMessage: string;
    extractionResult: string;
    onSaveToFile: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ isLoading, statusMessage, extractionResult, onSaveToFile }) => {
    return (
        <>
            {/* 2. 로딩 중일 때 상태 메시지를 표시하는 UI 추가 */}
            {isLoading && (
                <div className="status-container">
                    <p>{statusMessage || '분석을 준비 중입니다...'}</p>
                </div>
            )}

            {/* 3. 분석 결과가 있을 때만 결과 창을 표시 */}
            {extractionResult && (
                <FormField label="분석 결과">
                    <textarea value={extractionResult} readOnly rows={15} className="description-input" />
                    <button onClick={onSaveToFile} className="add-button" style={{ marginTop: '10px' }}>
                        💾 결과 저장하기 (.md)
                    </button>
                </FormField>
            )}
        </>
    );
};

export default ResultDisplay;
