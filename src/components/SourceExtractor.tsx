import React, { useState } from "react";
// ✨ Zustand 스토어를 직접 사용하기 위해 import 합니다.
import { useAnalysisStore } from "../store/analysisStore";
import { useAnalysis } from "../hooks/useAnalysis";
import { usePresets } from "../hooks/usePresets";

// UI 컴포넌트 임포트
import AnalysisForm from "./ui/AnalysisForm";
import CodeHeatmap from "./ui/CodeHeatmap";
import DependencyGraph from "./ui/DependencyGraph";
import FormField from "./ui/FormField";
import ResultDisplay from "./ui/ResultDisplay";
import Section from "./ui/Section";

/**
 * 소스 코드 분석기의 메인 컴포넌트입니다.
 * Form 상태를 관리하고, 분석 실행을 트리거하며, UI 컴포넌트들을 조립합니다.
 */
const SourceExtractor = () => {
  // --- Custom Hooks 호출 ---
  const presetsHook = usePresets();
  // ✨ useAnalysis 훅은 더 이상 상태를 반환하지 않습니다.
  const { isElectron, runAnalysis } = useAnalysis();

  // --- UI Form과 직접적으로 관련된 상태만 관리합니다 ---
  const [analysisMode, setAnalysisMode] = useState<"dependency" | "heatmap">("dependency");
  const [targetFunction, setTargetFunction] = useState<string>("");
  const [sourceMethod, setSourceMethod] = useState<"paste" | "upload" | "folder">("paste");
  const [pastedCode, setPastedCode] = useState<string>("");
  const [folderPath, setFolderPath] = useState<string>("");
  const [selectedFileObject, setSelectedFileObject] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");

  // --- 이벤트 핸들러 ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileObject(file);
      setSelectedFileName(file.name);
      if (isElectron && (file as any).path) {
        setSelectedFilePath((file as any).path);
      }
    } else {
      setSelectedFileObject(null);
      setSelectedFileName("");
      setSelectedFilePath("");
    }
  };

  const handleRunAnalysis = () => {
    runAnalysis({
      analysisMode,
      targetFunction,
      sourceMethod,
      pastedCode,
      folderPath,
      filePath: selectedFilePath,
      selectedFileObject,
    });
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = presetsHook.handlePresetChange(e.target.value);
    if (preset) {
      setAnalysisMode(preset.mode as "dependency");
      setTargetFunction(preset.targetFunction);
    }
  };

  const handleSavePreset = () => {
    if (analysisMode === "heatmap") {
      alert("코드 히트맵 모드에서는 프리셋을 저장할 수 없습니다.");
      return;
    }
    presetsHook.handleSavePreset({
      mode: analysisMode,
      targetFunction,
    });
  };

  const handleSaveToFile = () => {
    // ✨ 스토어에서 직접 상태를 가져옵니다. (getState 사용)
    const extractionResult = useAnalysisStore.getState().extractionResult;
    if (!extractionResult) {
      alert("저장할 결과가 없습니다.");
      return;
    }
    const blob = new Blob([extractionResult], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `source-analysis-result_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ✨ Form 버튼의 로딩 상태를 스토어에서 직접 구독합니다.
  const isLoading = useAnalysisStore((state) => state.isLoading);

  return (
    <Section title="1. 소스 코드 추출기">
      <AnalysisForm
        // Form 상태와 핸들러
        analysisMode={analysisMode}
        setAnalysisMode={setAnalysisMode}
        targetFunction={targetFunction}
        setTargetFunction={setTargetFunction}
        sourceMethod={sourceMethod}
        setSourceMethod={setSourceMethod}
        pastedCode={pastedCode}
        setPastedCode={setPastedCode}
        folderPath={folderPath}
        setFolderPath={setFolderPath}
        selectedFileName={selectedFileName}
        onFileChange={handleFileChange}
        onRunAnalysis={handleRunAnalysis}
        // ✨ 스토어와 훅에서 가져온 상태
        isLoading={isLoading}
        isElectron={isElectron}
        // Presets Hook에서 가져온 상태와 핸들러
        presets={presetsHook.presets}
        selectedPreset={presetsHook.selectedPreset}
        newPresetName={presetsHook.newPresetName}
        onPresetChange={handlePresetChange}
        onNewPresetNameChange={(e) => presetsHook.setNewPresetName(e.target.value)}
        onSavePreset={handleSavePreset}
        onDeletePreset={presetsHook.handleDeletePreset}
        onExportPresets={presetsHook.handleExportPresets}
        onImportPresets={presetsHook.handleImportPresets}
      />

      {analysisMode === "heatmap" ? (
        <>
          <FormField label="분석할 폴더 경로" description="코드 히트맵은 데스크톱 앱에서만 사용할 수 있습니다.">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="예: C:\Users\YourName\Projects\my-project\src"
              disabled={!isElectron}
            />
          </FormField>
          {isElectron && folderPath && <CodeHeatmap folderPath={folderPath} />}
        </>
      ) : (
        <>
          {/* ✨ DependencyGraph와 ResultDisplay는 이제 스스로 스토어에서 데이터를 가져옵니다. */}
          <DependencyGraph />
          <ResultDisplay onSaveToFile={handleSaveToFile} />
        </>
      )}
    </Section>
  );
};

export default SourceExtractor;