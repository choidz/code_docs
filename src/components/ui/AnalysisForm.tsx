import React from 'react';
import type { AnalysisPreset } from '../../types'; // 프리셋 타입을 사용하기 위해 import 합니다.
import FormField from './FormField';


// 부모로부터 받을 모든 props를 정의합니다.
interface AnalysisFormProps {
    analysisMode: 'keyword' | 'dependency';
    setAnalysisMode: (mode: 'keyword' | 'dependency') => void;
    keywords: string;
    setKeywords: (keywords: string) => void;
    targetFunction: string;
    setTargetFunction: (name: string) => void;

    sourceMethod: 'paste' | 'upload' | 'folder';
    setSourceMethod: (method: 'paste' | 'upload' | 'folder') => void;

    pastedCode: string;
    setPastedCode: (code: string) => void;
    folderPath: string;
    setFolderPath: (path: string) => void;

    selectedFileName: string;

    isLoading: boolean;
    onRunAnalysis: () => void;
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;

    isElectron: boolean;


    // --- 프리셋 관련 props ---
    presets: AnalysisPreset[];
    selectedPreset: string;
    newPresetName: string;
    onPresetChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onNewPresetNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSavePreset: () => void;
    onDeletePreset: () => void;
}

const AnalysisForm: React.FC<AnalysisFormProps> = (props) => {
   return (
        <>
            {/* [구조] 폼 필드들을 감싸는 컨테이너 추가 */}
            <div className="form-content">
                <FormField label="분석 종류 선택">
                    <select value={props.analysisMode} onChange={e => props.setAnalysisMode(e.target.value as any)}>
                        <option value="keyword">키워드 검색</option>
                        <option value="dependency">의존성 분석 (JS/TS)</option>
                    </select>
                </FormField>

                {props.analysisMode === 'keyword' && (
                    <>
                        <FormField label="추출할 키워드" description={`콤마(,)로 구분하여 입력 (${props.keywords.split(',').filter(k => k.trim()).length}개)`}>
                            <textarea value={props.keywords} onChange={(e) => props.setKeywords(e.target.value)} rows={3} placeholder="예: private, SELECT, api_key"/>
                        </FormField>
                    </>
                )}

                {props.analysisMode === 'dependency' && (
                    <FormField label="대상 함수 이름" description="이 함수가 호출하는 다른 함수들을 찾습니다.">
                        <input type="text" value={props.targetFunction} onChange={e => props.setTargetFunction(e.target.value)} placeholder="예: handlePayment" />
                    </FormField>
                )}

                <FormField label="소스 위치 선택">
    <div className="radio-group">
        <input type="radio" id="paste" value="paste" checked={props.sourceMethod === 'paste'} onChange={(e) => props.setSourceMethod(e.target.value as any)} />
        <label htmlFor="paste">코드 직접 입력</label>
        
        <input type="radio" id="upload" value="upload" checked={props.sourceMethod === 'upload'} onChange={(e) => props.setSourceMethod(e.target.value as any)} />
        <label htmlFor="upload">파일/ZIP 업로드</label>
        
        <input type="radio" id="folder" value="folder" checked={props.sourceMethod === 'folder'} onChange={(e) => props.setSourceMethod(e.target.value as any)} disabled={!props.isElectron} />
        {/* ▼▼▼ [수정] disabled prop을 className으로 변경 ▼▼▼ */}
        <label 
            htmlFor="folder" 
            className={!props.isElectron ? 'disabled' : ''}
        >
            로컬 폴더
        </label>
    </div>
</FormField>

                {props.sourceMethod === 'paste' && (
                    <FormField label="소스 코드 입력">
                        <textarea value={props.pastedCode} onChange={e => props.setPastedCode(e.target.value)} rows={8} placeholder="여기에 분석할 코드를 붙여넣으세요." />
                    </FormField>
                )}
                {props.sourceMethod === 'upload' && (
                    <FormField label="소스 위치 선택">
                        <input type="file" onChange={props.onFileChange} id="file-upload-input" style={{ display: 'none' }} />
                        <label htmlFor="file-upload-input" className="file-input-label">
                            {props.selectedFileName ? `✔️ ${props.selectedFileName}` : '파일 또는 ZIP 선택...'}
                        </label>
                    </FormField>
                )}
                {props.sourceMethod === 'folder' && (
                    <FormField label="분석할 폴더 경로">
                        <input type="text" value={props.folderPath} onChange={e => props.setFolderPath(e.target.value)} placeholder="예: C:\Users\YourName\Projects\my-project\src" />
                    </FormField>
                )}

                <FormField label="분석 프리셋">
                    <div className="preset-controls">
                        <select value={props.selectedPreset} onChange={props.onPresetChange}>
                            <option value="">-- 저장된 프리셋 불러오기 --</option>
                            {props.presets.map((p) => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="현재 설정을 새 프리셋으로 저장"
                            value={props.newPresetName}
                            onChange={props.onNewPresetNameChange}
                        />
                         {/* [변경] 버튼 클래스 및 스타일 변경 */}
                        <div className="preset-actions">
                            <button onClick={props.onSavePreset} className="btn btn-secondary">저장</button>
                            <button onClick={props.onDeletePreset} disabled={!props.selectedPreset} className="btn btn-tertiary">삭제</button>
                        </div>
                    </div>
                </FormField>
            </div>

            {/* [구조] 폼의 메인 액션 버튼을 위한 푸터 영역 */}
            <div className="form-footer">
                <button 
                    onClick={props.onRunAnalysis} 
                    className="btn-primary-solid" // [변경] 메인 액션 버튼 클래스
                    disabled={props.isLoading}
                >
                    {props.isLoading ? '분석 중...' : '분석 실행'}
                </button>
            </div>
        </>
    );
};

export default AnalysisForm;
