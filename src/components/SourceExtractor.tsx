import React, { useEffect, useState } from "react";

import JSZip from "jszip";
import { type Edge, type Node, MarkerType } from "reactflow";
import {
  parseKeywords,
  runAdvancedKeywordAnalysis,
  runCallHierarchyAnalysis,
  runDependencyAnalysis,
} from "../lib/analysis";
import { loadPresets, savePresets } from "../lib/presetManager";
import type { AnalysisPreset } from "../types";

// UI 컴포넌트 임포트
import AnalysisForm from "./ui/AnalysisForm";
import CodeHeatmap from "./ui/CodeHeatmap";
import DependencyGraph from "./ui/DependencyGraph";
import FormField from "./ui/FormField";
import ResultDisplay from "./ui/ResultDisplay";
import Section from "./ui/Section";

// React Flow 그래프 데이터를 위한 인터페이스 정의
interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

/**
 * 소스 코드 분석기의 메인 컴포넌트입니다.
 * 모든 UI 상태와 분석 로직 실행을 관리합니다.
 */
const SourceExtractor = () => {
  // --- 상태 관리 (모두 그대로) ---
  const [analysisMode, setAnalysisMode] = useState<
    "keyword" | "dependency" | "heatmap" | "callHierarchy"
  >("dependency");
  // ... (다른 모든 상태 선언은 기존과 동일)
  const [keywords, setKeywords] = useState<string>("private, SELECT");
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
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [extractionResult, setExtractionResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    edges: [],
  });
  const [presets, setPresets] = useState<AnalysisPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [newPresetName, setNewPresetName] = useState<string>("");
  const [isElectron, setIsElectron] = useState<boolean>(false);

  // [수정] Electron과 웹에서 공통으로 사용할 결과 처리 함수
  const processAnalysisResult = (result: any) => {
    if (!result || !result.findings || result.findings.length === 0) {
      setExtractionResult("분석 결과를 찾지 못했습니다.");
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    let fullReport = `# 📝 분석 결과\n\n`;

    result.findings.forEach((findingGroup: any) => {
      fullReport += `## 📄 소스: ${findingGroup.file}\n`;

      if (result.analysisType === "dependency") {
        const { target, dependencies } = findingGroup;
        setGraphData(createDependencyGraphData(result.target, dependencies));
        fullReport += `### 🎯 타겟 함수: \`${result.target}\`\n\`\`\`javascript\n${target}\n\`\`\`\n`;
        if (dependencies.length > 0) {
          fullReport += `\n#### 📞 호출하는 함수 목록\n`;
          dependencies.forEach((dep: any) => {
            fullReport += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
          });
        }
      } else if (result.analysisType === "callHierarchy") {
        const { callers } = findingGroup;
        setGraphData(createCallHierarchyGraphData(result.target, callers));
        fullReport += `### 📞 \`${result.target}\` 함수를 호출하는 함수 목록\n`;
        callers.forEach((caller: any) => {
          fullReport += `\n* **\`${caller.name}\`**\n\`\`\`javascript\n${caller.content}\n\`\`\`\n`;
        });
      } else if (result.analysisType === "keyword") {
        const { results } = findingGroup;
        setGraphData(createKeywordGraphData(results, parseKeywords(keywords)));
        results.forEach((finding: any) => {
          fullReport += `\n---\n**[함수: ${finding.functionName
            }] 키워드 \`${finding.foundKeywords.join(
              ", "
            )}\` 발견**\n\`\`\`javascript\n${finding.content}\n\`\`\`\n`;
        });
      }
    });

    setExtractionResult(fullReport);
  };

  useEffect(() => {
    const electronCheck = !!window.electronAPI;
    setIsElectron(electronCheck);
    setPresets(loadPresets());
    if (electronCheck) {
      const removeAnalysisResultListener = window.electronAPI.onAnalysisResult(
        (result: any) => {
          setIsLoading(false);
          // [수정] 공통 결과 처리 함수 호출
          processAnalysisResult(result);
        }
      );
      const removeStatusUpdateListener = window.electronAPI.onStatusUpdate(
        (message) => {
          setStatusMessage(message);
        }
      );
      return () => {
        removeAnalysisResultListener();
        removeStatusUpdateListener();
      };
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileObject(null);
      setSelectedFileName("");
      setSelectedFilePath("");
      return;
    }
    setSelectedFileObject(file);
    setSelectedFileName(file.name);
    if (isElectron) {
      const filePath = (file as any).path;
      if (filePath) setSelectedFilePath(filePath);
      else alert("파일 경로를 가져오는 데 실패했습니다.");
    }
  };

  // [변경] handleRunAnalysis 함수를 아래 내용으로 전체 교체합니다.
  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setExtractionResult("");
    setStatusMessage("");
    setGraphData({ nodes: [], edges: [] });

    // Electron 환경일 경우, 기존처럼 main 프로세스에 분석을 요청합니다.
    if (isElectron) {
      window.electronAPI.runAnalysis({
        analysisType: analysisMode,
        keywords,
        shouldExtractBlocks,
        targetFunction,
        sourceMethod,
        pastedCode,
        folderPath,
        filePath: selectedFilePath,
      });
      return; // Electron 요청 후 함수 종료
    }

    // --- 웹 브라우저 환경을 위한 새로운 통합 분석 로직 ---
    try {
      if (sourceMethod === "folder") {
        alert("폴더 분석은 데스크톱 앱에서만 지원됩니다.");
        setIsLoading(false);
        return;
      }

      // 1. 분석할 소스코드 목록을 준비합니다.
      const filesToAnalyze: { name: string; content: string }[] = [];
      setStatusMessage("분석할 파일을 준비 중입니다...");

      if (sourceMethod === "paste") {
        if (!pastedCode) throw new Error("분석할 소스 코드를 입력해야 합니다.");
        filesToAnalyze.push({ name: "붙여넣은 코드", content: pastedCode });
      } else if (sourceMethod === "upload" && selectedFileObject) {
        if (selectedFileObject.name.toLowerCase().endsWith(".zip")) {
          const zip = await JSZip.loadAsync(selectedFileObject);
          for (const zipEntry of Object.values(zip.files)) {
            if (!zipEntry.dir) {
              const content = await zipEntry.async("string");
              filesToAnalyze.push({ name: zipEntry.name, content });
            }
          }
        } else {
          const content = await selectedFileObject.text();
          filesToAnalyze.push({ name: selectedFileObject.name, content });
        }
      }

      if (filesToAnalyze.length === 0) {
        setExtractionResult("분석할 내용이 없습니다.");
        setIsLoading(false);
        return;
      }

      // 2. Electron의 main.js와 동일한 방식으로 파일을 순회하며 분석을 수행합니다.
      setStatusMessage(`${filesToAnalyze.length}개 파일에 대한 분석을 시작합니다...`);
      const finalResult = {
        analysisType: analysisMode,
        target: targetFunction,
        findings: [] as any[],
      };

      for (const file of filesToAnalyze) {
        let findings: any = null;

        switch (analysisMode) {
          case "keyword":
            const parsed = parseKeywords(keywords);
            if (parsed.length > 0) {
              const results = runAdvancedKeywordAnalysis(file.content, parsed);
              if (results && results.length > 0) {
                findings = { results }; // main.js와 데이터 구조를 맞춰줍니다.
              }
            }
            break;

          case "dependency":
            if (targetFunction) {
              const result = runDependencyAnalysis(file.content, targetFunction);
              if (result && result.target) {
                findings = result;
              }
            }
            break;

          case "callHierarchy":
            if (targetFunction) {
              const result = runCallHierarchyAnalysis(file.content, targetFunction);
              if (result && result.callers.length > 0) {
                findings = result;
              }
            }
            break;
        }

        if (findings) {
          finalResult.findings.push({ file: file.name, ...findings });
        }
      }

      // 3. 통합된 최종 결과를 공통 처리 함수로 전달합니다.
      processAnalysisResult(finalResult);

    } catch (error) {
      console.error("웹 분석 중 오류:", error);
      setExtractionResult(
        "# ❗ 분석 중 오류가 발생했습니다.\n\n" + (error as Error).message
      );
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetName = e.target.value;
    setSelectedPreset(presetName);
    const preset = presets.find((p) => p.name === presetName);
    if (preset) {
      const mode = preset.mode as "keyword" | "dependency";
      setAnalysisMode(mode);
      setKeywords(preset.keywords);
      setTargetFunction(preset.targetFunction);
      setShouldExtractBlocks(preset.shouldExtractBlocks);
    }
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      alert("프리셋 이름을 입력해주세요.");
      return;
    }
    if (analysisMode === "heatmap") {
      alert("코드 히트맵 모드에서는 프리셋을 저장할 수 없습니다.");
      return;
    }
    const trimmedName = newPresetName.trim();
    if (presets.some((p) => p.name === trimmedName)) {
      alert("이미 사용 중인 이름입니다.");
      return;
    }
    const newPreset: AnalysisPreset = {
      name: trimmedName,
      mode: analysisMode,
      keywords: keywords,
      targetFunction: targetFunction,
      shouldExtractBlocks: shouldExtractBlocks,
    };
    const updatedPresets = [...presets, newPreset].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setPresets(updatedPresets);
    savePresets(updatedPresets);
    setNewPresetName("");
    setSelectedPreset(trimmedName);
    alert(`'${trimmedName}' 프리셋이 저장되었습니다!`);
  };

  const handleDeletePreset = () => {
    if (!selectedPreset) {
      alert("삭제할 프리셋을 선택해주세요.");
      return;
    }
    if (window.confirm(`'${selectedPreset}' 프리셋을 정말 삭제하시겠습니까?`)) {
      const updatedPresets = presets.filter((p) => p.name !== selectedPreset);
      setPresets(updatedPresets);
      savePresets(updatedPresets);
      setSelectedPreset("");
    }
  };

  /**
   * [신규] 호출 계층 분석 결과를 바탕으로 React Flow 그래프 데이터를 생성합니다.
   */
  const createCallHierarchyGraphData = (
    target: string,
    callers: { name: string }[]
  ): GraphData => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeSet = new Set<string>();

    // 타겟 노드를 중앙에 배치
    nodes.push({
      id: target,
      data: { label: target },
      position: { x: 250, y: 100 + Math.floor(callers.length / 2) * 50 },
      type: "output",
      style: {
        backgroundColor: "#FFDDC1",
        borderColor: "#FF6B6B",
        width: "auto",
        minWidth: 150,
      },
    });
    nodeSet.add(target);

    // 호출자 노드들을 왼쪽에 배치
    callers.forEach((caller, index) => {
      if (!nodeSet.has(caller.name)) {
        nodes.push({
          id: caller.name,
          data: { label: caller.name },
          position: { x: 0, y: index * 100 },
          style: { width: "auto", minWidth: 150 },
        });
        nodeSet.add(caller.name);
      }
      edges.push({
        id: `e-${caller.name}-${target}`,
        source: caller.name,
        target: target,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });
    return { nodes, edges };
  };

  // // [수정] 웹 버전 분석 로직이 데이터 '객체'를 반환하도록 변경
  // const performWebAnalysis = (content: string) => {
  //   setStatusMessage("웹 브라우저에서 분석을 수행합니다...");

  //   if (analysisMode === "keyword") {
  //     const parsedKeywords = parseKeywords(keywords);
  //     if (parsedKeywords.length === 0) return null;
  //     const results = runAdvancedKeywordAnalysis(content, parsedKeywords);
  //     return { results };
  //   }
  //   if (analysisMode === "dependency") {
  //     if (!targetFunction || targetFunction.trim() === "") return null;
  //     return runDependencyAnalysis(content, targetFunction);
  //   }
  //   if (analysisMode === "callHierarchy") {
  //     if (!targetFunction || targetFunction.trim() === "") return null;
  //     return runCallHierarchyAnalysis(content, targetFunction);
  //   }
  //   return null;
  // };

  const createKeywordGraphData = (
    findings: { functionName: string; foundKeywords: string[] }[],
    keywords: string[]
  ): GraphData => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    keywords.forEach((keyword, index) => {
      nodes.push({
        id: `keyword-${keyword}`,
        data: { label: keyword },
        position: { x: index * 200, y: 0 },
        type: "input",
        style: {
          backgroundColor: "#FFFBE6",
          borderColor: "#FFC107",
          width: "auto",
          minWidth: 120,
          textAlign: "center",
        },
      });
    });
    const functionNodes = new Map<string, Node>();
    findings.forEach((finding) => {
      if (!functionNodes.has(finding.functionName)) {
        functionNodes.set(finding.functionName, {
          id: finding.functionName,
          data: { label: finding.functionName },
          position: { x: 0, y: 0 },
          style: { width: "auto", minWidth: 150 },
        });
      }
    });
    let funcNodeIndex = 0;
    functionNodes.forEach((node) => {
      node.position = { x: funcNodeIndex * 200, y: 150 };
      nodes.push(node);
      funcNodeIndex++;
    });
    findings.forEach((finding) => {
      finding.foundKeywords.forEach((keyword) => {
        edges.push({
          id: `e-keyword-${keyword}-${finding.functionName}`,
          source: `keyword-${keyword}`,
          target: finding.functionName,
        });
      });
    });
    return { nodes, edges };
  };

  const createDependencyGraphData = (
    target: string,
    dependencies: { name: string }[]
  ): GraphData => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeSet = new Set<string>();

    // 타겟 노드를 중앙에 배치
    nodes.push({
      id: target,
      data: { label: target },
      position: { x: 250, y: 0 },
      type: "input",
      style: {
        backgroundColor: "#DFF4FF",
        borderColor: "#4A90E2",
        width: "auto",
        minWidth: 150,
      },
    });
    nodeSet.add(target);

    // 의존성 노드들을 주변에 배치
    dependencies.forEach((dep, index) => {
      if (!nodeSet.has(dep.name)) {
        nodes.push({
          id: dep.name,
          data: { label: dep.name },
          position: {
            x: (index % 2) * 500,
            y: 100 + Math.floor(index / 2) * 100,
          },
          style: { width: "auto", minWidth: 150 },
        });
        nodeSet.add(dep.name);
      }
      edges.push({
        id: `e-${target}-${dep.name}`,
        source: target,
        target: dep.name,
        animated: true,
      });
    });
    return { nodes, edges };
  };

  const handleSaveToFile = () => {
    if (!extractionResult) {
      alert("저장할 결과가 없습니다.");
      return;
    }
    const blob = new Blob([extractionResult], { type: "text/markdown" });
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

  const handleExportPresets = () => {
    if (presets.length === 0) {
      alert("내보낼 프리셋이 없습니다.");
      return;
    }
    const dataStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "source-analyzer-presets.json";
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };

  const handleImportPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedPresets: AnalysisPreset[] = JSON.parse(text);
        if (
          !Array.isArray(importedPresets) ||
          !importedPresets.every((p) => p.name && p.mode)
        ) {
          throw new Error("유효하지 않은 프리셋 파일 형식입니다.");
        }
        const mergedPresetsMap = new Map<string, AnalysisPreset>();
        [...presets, ...importedPresets].forEach((p) =>
          mergedPresetsMap.set(p.name, p)
        );
        const updatedPresets = Array.from(mergedPresetsMap.values()).sort(
          (a, b) => a.name.localeCompare(b.name)
        );
        setPresets(updatedPresets);
        savePresets(updatedPresets);
        alert(
          `${importedPresets.length}개의 프리셋을 가져왔습니다. (총 ${updatedPresets.length}개)`
        );
      } catch (error) {
        alert(
          `프리셋을 가져오는 중 오류가 발생했습니다: ${(error as Error).message
          }`
        );
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <Section title='1. 소스 코드 추출기'>
      {/* ▼▼▼ [핵심] AnalysisForm을 항상 렌더링합니다. ▼▼▼ */}
      <AnalysisForm
        analysisMode={analysisMode}
        setAnalysisMode={setAnalysisMode}
        keywords={keywords}
        setKeywords={setKeywords}
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
        isLoading={isLoading}
        onRunAnalysis={handleRunAnalysis}
        onFileChange={handleFileChange}
        isElectron={isElectron}
        presets={presets}
        selectedPreset={selectedPreset}
        newPresetName={newPresetName}
        onPresetChange={handlePresetChange}
        onNewPresetNameChange={(e) => setNewPresetName(e.target.value)}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onExportPresets={handleExportPresets}
        onImportPresets={handleImportPresets}
      />

      {/* ▼▼▼ [핵심] analysisMode에 따라 추가적인 UI를 렌더링합니다. ▼▼▼ */}
      {analysisMode === "heatmap" ? (
        // "코드 히트맵" 모드일 때 추가 UI
        <>
          <FormField
            label='분석할 폴더 경로'
            description='코드 히트맵은 데스크톱 앱에서만 사용할 수 있습니다.'>
            <input
              type='text'
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder='예: C:\Users\YourName\Projects\my-project\src'
              disabled={!isElectron}
            />
          </FormField>
          {isElectron && folderPath && <CodeHeatmap folderPath={folderPath} />}
        </>
      ) : (
        // "키워드" 또는 "의존성" 분석 모드일 때 추가 UI
        <>
          {graphData.nodes.length > 0 && (
            <DependencyGraph nodes={graphData.nodes} edges={graphData.edges} />
          )}
          <ResultDisplay
            isLoading={isLoading}
            statusMessage={statusMessage}
            extractionResult={extractionResult}
            onSaveToFile={handleSaveToFile}
          />
        </>
      )}
    </Section>
  );
};

export default SourceExtractor;
