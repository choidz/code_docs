import React from "react";
import type { AnalysisPreset } from "../../types"; // 프리셋 타입을 사용하기 위해 import 합니다.
import FormField from "./FormField";

// 부모로부터 받을 모든 props를 정의합니다.
interface AnalysisFormProps {
  analysisMode: "keyword" | "dependency";
  setAnalysisMode: (mode: "keyword" | "dependency") => void;
  keywords: string;
  setKeywords: (keywords: string) => void;
  shouldExtractBlocks: boolean;
  setShouldExtractBlocks: (should: boolean) => void;
  targetFunction: string;
  setTargetFunction: (name: string) => void;

  sourceMethod: "paste" | "upload" | "folder";
  setSourceMethod: (method: "paste" | "upload" | "folder") => void;

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

  onExportPresets: () => void;
  onImportPresets: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const AnalysisForm: React.FC<AnalysisFormProps> = (props) => {
  return (
    <>
      <FormField label='🔍 분석 종류 선택'>
        <select
          value={props.analysisMode}
          onChange={(e) => props.setAnalysisMode(e.target.value as any)}
          className='language-select'>
          <option value='keyword'>🔑 키워드 검색</option>
          <option value='dependency'>🔗 의존성 분석 (JS/TS)</option>
        </select>
      </FormField>

      {props.analysisMode === "keyword" && (
        <>
          <FormField
            label='추출할 키워드'
            description={`찾고 싶은 키워드를 콤마(,)로 구분하여 입력하세요. (${
              props.keywords.split(",").filter((k) => k.trim()).length
            }개 입력됨)`}>
            <textarea
              value={props.keywords}
              onChange={(e) => props.setKeywords(e.target.value)}
              rows={3}
            />
          </FormField>
          <FormField label='분석 옵션'>
            <div className='ai-toggle-container'>
              <div className='toggle-switch'>
                <input
                  id='block-toggle'
                  type='checkbox'
                  checked={props.shouldExtractBlocks}
                  onChange={(e) =>
                    props.setShouldExtractBlocks(e.target.checked)
                  }
                />
                <label htmlFor='block-toggle' className='slider'></label>
              </div>
              <label htmlFor='block-toggle' className='toggle-label'>
                발견된 키워드를 포함한 전체 함수/블록 추출 시도
              </label>
            </div>
          </FormField>
        </>
      )}

      {props.analysisMode === "dependency" && (
        <FormField
          label='대상 함수 이름'
          description='이 함수가 호출하는 다른 함수들을 찾습니다.'>
          <input
            type='text'
            value={props.targetFunction}
            onChange={(e) => props.setTargetFunction(e.target.value)}
            placeholder='예: handlePayment'
          />
        </FormField>
      )}

      <div className='or-divider'></div>

      <FormField label='📂 소스 위치 선택'>
        <div className='radio-group'>
          <label>
            <input
              type='radio'
              value='paste'
              checked={props.sourceMethod === "paste"}
              onChange={(e) => props.setSourceMethod(e.target.value as any)}
            />
            코드 직접 입력
          </label>
          <label>
            <input
              type='radio'
              value='upload'
              checked={props.sourceMethod === "upload"}
              onChange={(e) => props.setSourceMethod(e.target.value as any)}
            />
            파일/ZIP 업로드
          </label>
          <label>
            <input
              type='radio'
              value='folder'
              checked={props.sourceMethod === "folder"}
              onChange={(e) => props.setSourceMethod(e.target.value as any)}
              // isElectron이 false일 때 (웹 브라우저일 때) 비활성화
              disabled={!props.isElectron}
            />
            로컬 폴더 경로
          </label>
        </div>
      </FormField>

      {props.sourceMethod === "paste" && (
        <FormField label='소스 코드 입력'>
          <textarea
            value={props.pastedCode}
            onChange={(e) => props.setPastedCode(e.target.value)}
            rows={8}
            placeholder='여기에 분석할 코드를 붙여넣으세요.'
          />
        </FormField>
      )}
      {props.sourceMethod === "upload" && (
        <FormField label='파일/ZIP 업로드'>
          {/* 실제 input은 숨기고, label을 버튼처럼 사용합니다. */}
          <input
            type='file'
            onChange={props.onFileChange}
            className='file-input'
            id='file-upload-input'
            style={{ display: "none" }}
          />
          <label htmlFor='file-upload-input' className='file-input-label'>
            {props.selectedFileName
              ? `✔️ ${props.selectedFileName}`
              : "파일 또는 ZIP 선택..."}
          </label>
        </FormField>
      )}
      {props.sourceMethod === "folder" && (
        <FormField label='분석할 폴더 경로'>
          <input
            type='text'
            value={props.folderPath}
            onChange={(e) => props.setFolderPath(e.target.value)}
            placeholder='예: C:\Users\YourName\Projects\my-project\src'
          />
        </FormField>
      )}

      <div className='or-divider'></div>

      <FormField label='🏷️ 분석 프리셋 (선택 사항)'>
        <div className='preset-controls'>
          {/* 프리셋 선택 */}
          <div className='preset-select-group'>
            <select
              value={props.selectedPreset}
              onChange={props.onPresetChange}
              className='preset-dropdown'>
              <option value=''>저장된 프리셋 불러오기</option>
              {props.presets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 새 프리셋 이름 입력 */}
          <div className='preset-save-group'>
            <input
              type='text'
              className='preset-input'
              placeholder='새 프리셋 이름 입력'
              value={props.newPresetName}
              onChange={props.onNewPresetNameChange}
            />
          </div>

          {/* 버튼들을 하단에 따로 배치 */}
          <div className='preset-actions'>
            {/* ▼▼▼ [추가] 가져오기/내보내기 버튼 UI ▼▼▼ */}
            <button
              onClick={props.onExportPresets}
              className='preset-btn export'>
              내보내기
            </button>
            {/* '가져오기'는 label을 버튼처럼 스타일링하여 숨겨진 input을 클릭하게 합니다. */}
            <label htmlFor='import-preset-input' className='preset-btn import'>
              가져오기
            </label>
            <input
              id='import-preset-input'
              type='file'
              accept='.json' // JSON 파일만 선택 가능하도록 제한
              style={{ display: "none" }}
              onChange={props.onImportPresets}
            />
            <button
              onClick={props.onDeletePreset}
              disabled={!props.selectedPreset}
              className='preset-btn delete'>
              삭제
            </button>
            <button onClick={props.onSavePreset} className='preset-btn save'>
              저장
            </button>
          </div>
        </div>
      </FormField>

      {/* '파일/ZIP 업로드' 모드가 아닐 때만 버튼이 보입니다. */}
      {/* {props.sourceMethod !== 'upload' && ( */}
      <button
        onClick={props.onRunAnalysis}
        className='add-button'
        disabled={props.isLoading}
        style={{ width: "100%" }}>
        {props.isLoading ? "분석 중..." : "분석 실행"}
      </button>
      {/* )} */}
    </>
  );
};

export default AnalysisForm;
