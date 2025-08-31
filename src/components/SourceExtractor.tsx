// src/components/SourceExtractor.tsx

import React, { useState } from "react";

// 리팩토링된 Custom Hooks 임포트
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
 * Custom Hooks를 사용하여 로직을 위임하고, UI 렌더링과 상태 연결을 담당합니다.
 */
const SourceExtractor = () => {
  // --- 로직과 관련 상태는 Custom Hooks에서 가져옵니다 ---
  const presetsHook = usePresets();
  const analysisHook = useAnalysis();

  // --- UI Form과 직접적으로 관련된 상태만 컴포넌트에서 관리합니다 ---
  const [analysisMode, setAnalysisMode] = useState<"dependency" | "heatmap">(
    "dependency"
  );
  const [shouldExtractBlocks, setShouldExtractBlocks] = useState<boolean>(true);
  const [targetFunction, setTargetFunction] = useState<string>("");
  const [sourceMethod, setSourceMethod] = useState<
    "paste" | "upload" | "folder"
  >("paste");
  const [pastedCode, setPastedCode] = useState<string>("");
  const [folderPath, setFolderPath] = useState<string>("");
  const [selectedFileObject, setSelectedFileObject] = useState<File | null>(
    null
  );
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [selectedFilePath, setSelectedFilePath] = useState<string>(""); // Electron 전용

  // --- 이벤트 핸들러: Hooks와 컴포넌트 상태를 연결하는 역할 ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileObject(file);
      setSelectedFileName(file.name);
      if (analysisHook.isElectron && (file as any).path) {
        setSelectedFilePath((file as any).path);
      }
    } else {
      setSelectedFileObject(null);
      setSelectedFileName("");
      setSelectedFilePath("");
    }
  };

  const handleRunAnalysis = () => {
    // 현재 Form의 모든 상태를 모아 analysisHook의 runAnalysis 함수에 전달합니다.
    analysisHook.runAnalysis({
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
      // 선택된 프리셋의 값으로 Form 상태를 업데이트합니다.
      setAnalysisMode(preset.mode as "dependency");
      setTargetFunction(preset.targetFunction);
    }
  };

  const handleSavePreset = () => {
    if (analysisMode === "heatmap") {
      alert("코드 히트맵 모드에서는 프리셋을 저장할 수 없습니다.");
      return; // 함수 실행을 중단
    }

    presetsHook.handleSavePreset({
      mode: analysisMode,
      targetFunction,
    });
  };

  const handleSaveToFile = () => {
    if (!analysisHook.extractionResult) {
      alert("저장할 결과가 없습니다.");
      return;
    }
    const blob = new Blob([analysisHook.extractionResult], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `source-analysis-result_${new Date()
      .toISOString()
      .slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Section title='1. 소스 코드 추출기'>
      <AnalysisForm
        // Form 상태와 핸들러
        analysisMode={analysisMode}
        setAnalysisMode={setAnalysisMode}
        shouldExtractBlocks={shouldExtractBlocks}
        setShouldExtractBlocks={setShouldExtractBlocks}
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
        // Analysis Hook에서 가져온 상태
        isLoading={analysisHook.isLoading}
        isElectron={analysisHook.isElectron}
        // Presets Hook에서 가져온 상태와 핸들러
        presets={presetsHook.presets}
        selectedPreset={presetsHook.selectedPreset}
        newPresetName={presetsHook.newPresetName}
        onPresetChange={handlePresetChange}
        onNewPresetNameChange={(e) =>
          presetsHook.setNewPresetName(e.target.value)
        }
        onSavePreset={handleSavePreset}
        onDeletePreset={presetsHook.handleDeletePreset}
        onExportPresets={presetsHook.handleExportPresets}
        onImportPresets={presetsHook.handleImportPresets}
      />

      {analysisMode === "heatmap" ? (
        <>
          <FormField
            label='분석할 폴더 경로'
            description='코드 히트맵은 데스크톱 앱에서만 사용할 수 있습니다.'>
            <input
              type='text'
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder='예: C:\Users\YourName\Projects\my-project\src'
              disabled={!analysisHook.isElectron}
            />
          </FormField>
          {analysisHook.isElectron && folderPath && (
            <CodeHeatmap folderPath={folderPath} />
          )}
        </>
      ) : (
        <>
          {analysisHook.graphData.nodes.length > 0 && (
            <DependencyGraph
              nodes={analysisHook.graphData.nodes}
              edges={analysisHook.graphData.edges}
            />
          )}
          <ResultDisplay
            isLoading={analysisHook.isLoading}
            statusMessage={analysisHook.statusMessage}
            extractionResult={analysisHook.extractionResult}
            onSaveToFile={handleSaveToFile}
          />
        </>
      )}
    </Section>
  );
};

export default SourceExtractor;
