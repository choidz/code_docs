import React from "react";
import type { AnalysisPreset } from "../../types";
import FormField from "./FormField";

// 부모로부터 받을 모든 props를 정의합니다.
interface AnalysisFormProps {
  analysisMode: "dependency" | "module" | "heatmap";
  setAnalysisMode: (mode: "dependency" | "module" | "heatmap") => void;
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
      <FormField label="🔍 분석 종류 선택">
        <select
          value={props.analysisMode}
          onChange={(e) =>
            props.setAnalysisMode(
              e.target.value as "dependency" | "module" | "heatmap"
            )
          }
          className="language-select"
        >
          <option value="dependency">🔗 함수 의존성 분석 (JS/TS)</option>
          <option value="react-analysis">⚛️ React 특화 분석</option>
          {/* ✨ [추가] isElectron일 때만 모듈 분석과 히트맵 옵션 표시 */}

          {props.isElectron && (
            <>
              <option value="module">🗺️ 모듈 의존성 그래프 (JS/TS)</option>
              <option value="heatmap">🔥 코드 히트맵</option>
            </>
          )}
        </select>
      </FormField>

      {/* 히트맵 모드가 아닐 때 나머지 폼 필드 표시 */}
      {props.analysisMode !== "heatmap" && (
        <>
          {/* ✨ [수정] 'dependency' 모드일 때만 대상 함수 이름 입력창 표시 */}
          {props.analysisMode === "dependency" && (
            <FormField
              label="대상 함수 이름"
              description="이 함수가 호출하는 다른 함수들을 찾습니다."
            >
              <input
                type="text"
                value={props.targetFunction}
                onChange={(e) => props.setTargetFunction(e.target.value)}
                placeholder="예: handlePayment"
              />
            </FormField>
          )}

          <div className="or-divider"></div>

          <FormField label="📂 소스 위치 선택">
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="paste"
                  checked={props.sourceMethod === "paste"}
                  onChange={(e) => props.setSourceMethod(e.target.value as any)}
                  // ✨ [추가] 모듈 분석 모드일 때는 비활성화
                  disabled={props.analysisMode === "module"}
                />
                코드 직접 입력
              </label>
              <label>
                <input
                  type="radio"
                  value="upload"
                  checked={props.sourceMethod === "upload"}
                  onChange={(e) => props.setSourceMethod(e.target.value as any)}
                // ✨ [추가] 모듈 분석 모드일 때는 비활성화
                // disabled={props.analysisMode === "module"}
                />
                파일/ZIP 업로드
              </label>
              <label>
                <input
                  type="radio"
                  value="folder"
                  checked={props.sourceMethod === "folder"}
                  onChange={(e) => props.setSourceMethod(e.target.value as any)}
                  disabled={!props.isElectron}
                />
                로컬 폴더 경로
              </label>
            </div>
          </FormField>

          {props.sourceMethod === "paste" && (
            <FormField label="소스 코드 입력">
              <textarea
                value={props.pastedCode}
                onChange={(e) => props.setPastedCode(e.target.value)}
                rows={8}
                placeholder="여기에 분석할 코드를 붙여넣으세요."
              />
            </FormField>
          )}
          {props.sourceMethod === "upload" && (
            <FormField label="파일/ZIP 업로드">
              <input
                type="file"
                onChange={props.onFileChange}
                className="file-input"
                id="file-upload-input"
                style={{ display: "none" }}
              />
              <label htmlFor="file-upload-input" className="file-input-label">
                {props.selectedFileName
                  ? `✔️ ${props.selectedFileName}`
                  : "파일 또는 ZIP 선택..."}
              </label>
            </FormField>
          )}
          {props.sourceMethod === "folder" && (
            <FormField label="분석할 폴더 경로">
              <input
                type="text"
                value={props.folderPath}
                onChange={(e) => props.setFolderPath(e.target.value)}
                placeholder="예: C:\Users\YourName\Projects\my-project\src"
              />
            </FormField>
          )}

          {/* ✨ [수정] 함수 의존성 분석일 때만 프리셋 기능 표시 */}
          {props.analysisMode === "dependency" && (
            <>
              <div className="or-divider"></div>
              <FormField label="🏷️ 분석 프리셋 (선택 사항)">
                <div className="preset-controls">
                  <div className="preset-select-group">
                    <select
                      value={props.selectedPreset}
                      onChange={props.onPresetChange}
                      className="preset-dropdown"
                    >
                      <option value="">저장된 프리셋 불러오기</option>
                      {props.presets.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="preset-save-group">
                    <input
                      type="text"
                      className="preset-input"
                      placeholder="새 프리셋 이름 입력"
                      value={props.newPresetName}
                      onChange={props.onNewPresetNameChange}
                    />
                  </div>
                  <div className="preset-actions">
                    <button
                      onClick={props.onExportPresets}
                      className="preset-btn export"
                    >
                      내보내기
                    </button>
                    <label
                      htmlFor="import-preset-input"
                      className="preset-btn import"
                    >
                      가져오기
                    </label>
                    <input
                      id="import-preset-input"
                      type="file"
                      accept=".json"
                      style={{ display: "none" }}
                      onChange={props.onImportPresets}
                    />
                    <button
                      onClick={props.onDeletePreset}
                      disabled={!props.selectedPreset}
                      className="preset-btn delete"
                    >
                      삭제
                    </button>
                    <button
                      onClick={props.onSavePreset}
                      className="preset-btn save"
                    >
                      저장
                    </button>
                  </div>
                </div>
              </FormField>
            </>
          )}

          <button
            onClick={props.onRunAnalysis}
            className="add-button"
            disabled={props.isLoading}
            style={{ width: "100%" }}
          >
            {props.isLoading ? "분석 중..." : "분석 실행"}
          </button>
        </>
      )}
    </>
  );
};

export default AnalysisForm;
