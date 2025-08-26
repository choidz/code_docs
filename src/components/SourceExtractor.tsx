import React, { useEffect, useState } from "react";

import JSZip from "jszip";
import type { Edge, Node } from "reactflow";
import {
  parseKeywords,
  runAdvancedKeywordAnalysis,
  runDependencyAnalysis,
} from "../lib/analysis";
import { loadPresets, savePresets } from "../lib/presetManager";
import type { AnalysisPreset } from "../types";
import AnalysisForm from "./ui/AnalysisForm";
import DependencyGraph from "./ui/DependencyGraph";
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
  // --- UI 및 분석 옵션 상태 관리 ---
  const [analysisMode, setAnalysisMode] = useState<"keyword" | "dependency">(
    "dependency"
  );
  const [keywords, setKeywords] = useState<string>("private, SELECT");
  const [shouldExtractBlocks, setShouldExtractBlocks] = useState<boolean>(true);
  const [targetFunction, setTargetFunction] = useState<string>("");
  const [sourceMethod, setSourceMethod] = useState<
    "paste" | "upload" | "folder"
  >("paste");

  // --- 입력 소스 데이터 상태 관리 ---
  const [pastedCode, setPastedCode] = useState<string>("");
  const [folderPath, setFolderPath] = useState<string>("");
  const [selectedFileObject, setSelectedFileObject] = useState<File | null>(
    null
  );
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [selectedFilePath, setSelectedFilePath] = useState<string>(""); // Electron 전용

  // --- 분석 결과 및 진행 상태 관리 ---
  const [extractionResult, setExtractionResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    edges: [],
  });

  // --- 프리셋 기능 상태 관리 ---
  const [presets, setPresets] = useState<AnalysisPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [newPresetName, setNewPresetName] = useState<string>("");

  // --- 환경 상태 관리 ---
  const [isElectron, setIsElectron] = useState<boolean>(false);

  // 컴포넌트 마운트 시 실행되는 초기화 로직
  useEffect(() => {
    // 현재 실행 환경이 Electron인지 확인하여 상태에 저장
    const electronCheck = !!window.electronAPI;
    setIsElectron(electronCheck);

    // localStorage에서 저장된 프리셋 목록을 불러옴
    setPresets(loadPresets());

    // Electron 환경일 경우, 메인 프로세스로부터 오는 이벤트 리스너 설정
    if (electronCheck) {
      // 분석 결과 수신 리스너
      window.electronAPI.onAnalysisResult((result) => {
        setExtractionResult(result);
        setIsLoading(false);
      });
      // 진행 상태 메시지 수신 리스너
      window.electronAPI.onStatusUpdate((message) => {
        setStatusMessage(message);
      });
    }
  }, []);

  /**
   * 사용자가 파일을 업로드했을 때 호출되는 이벤트 핸들러입니다.
   * @param event 파일 input의 변경 이벤트
   */
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

    // Electron 환경에서는 파일의 실제 경로를 추가로 저장합니다.
    if (isElectron) {
      const filePath = (file as any).path;
      if (filePath) {
        setSelectedFilePath(filePath);
      } else {
        alert("파일 경로를 가져오는 데 실패했습니다.");
      }
    }
  };

  /**
   * '분석 실행' 버튼 클릭 시 호출되는 메인 함수입니다.
   * 현재 환경(웹/Electron)에 따라 적절한 분석 로직을 호출합니다.
   */
  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setExtractionResult("");
    setStatusMessage("");
    setGraphData({ nodes: [], edges: [] });

    // Electron 환경에서는 메인 프로세스에 분석 작업을 위임합니다.
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
    } else {
      // 웹 브라우저 환경에서는 클라이언트 사이드에서 직접 분석을 수행합니다.
      try {
        if (sourceMethod === "folder") {
          alert("폴더 분석은 데스크톱 앱에서만 지원됩니다.");
          setIsLoading(false);
          return;
        }

        let result = "";
        if (sourceMethod === "paste") {
          result = performWebAnalysis(pastedCode, "Pasted Code");
        } else if (sourceMethod === "upload" && selectedFileObject) {
          if (selectedFileObject.name.toLowerCase().endsWith(".zip")) {
            result = await performWebZipAnalysis(selectedFileObject);
          } else {
            const content = await selectedFileObject.text();
            result = performWebAnalysis(content, selectedFileObject.name);
          }
        }
        setExtractionResult(result || "분석 결과를 찾지 못했습니다.");
      } catch (error) {
        console.error("웹 분석 중 오류:", error);
        setExtractionResult(
          "# ❗ 분석 중 오류가 발생했습니다.\n\n" + (error as Error).message
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * 저장된 프리셋을 선택했을 때 UI 상태를 업데이트하는 함수입니다.
   * @param e select 요소의 변경 이벤트
   */
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetName = e.target.value;
    setSelectedPreset(presetName);

    const preset = presets.find((p) => p.name === presetName);
    if (preset) {
      setAnalysisMode(preset.mode);
      setKeywords(preset.keywords);
      setTargetFunction(preset.targetFunction);
      setShouldExtractBlocks(preset.shouldExtractBlocks);
    }
  };

  /**
   * 현재 분석 설정을 새로운 프리셋으로 localStorage에 저장하는 함수입니다.
   */
  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      alert("프리셋 이름을 입력해주세요.");
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
    savePresets(updatedPresets); // localStorage에 실제 저장

    setNewPresetName("");
    setSelectedPreset(trimmedName);
    alert(`'${trimmedName}' 프리셋이 저장되었습니다!`);
  };

  /**
   * 선택된 프리셋을 localStorage에서 삭제하는 함수입니다.
   */
  const handleDeletePreset = () => {
    if (!selectedPreset) {
      alert("삭제할 프리셋을 선택해주세요.");
      return;
    }

    if (window.confirm(`'${selectedPreset}' 프리셋을 정말 삭제하시겠습니까?`)) {
      const updatedPresets = presets.filter((p) => p.name !== selectedPreset);
      setPresets(updatedPresets);
      savePresets(updatedPresets); // localStorage에서 실제 삭제
      setSelectedPreset("");
    }
  };

  /**
   * 웹 브라우저 환경에서 ZIP 파일의 압축을 해제하고 내부 파일들을 분석하는 함수입니다.
   * @param file 사용자가 업로드한 ZIP 파일 객체
   * @returns 모든 파일의 분석 결과를 종합한 Markdown 문자열
   */
  const performWebZipAnalysis = async (file: File): Promise<string> => {
    setStatusMessage("웹 브라우저에서 ZIP 파일 압축을 해제하고 분석합니다...");
    const zip = await JSZip.loadAsync(file);
    let fullReport = `# 📝 분석 결과 (ZIP: ${file.name})\n\n`;
    let foundSomething = false;

    for (const zipEntry of Object.values(zip.files)) {
      if (!zipEntry.dir) {
        const content = await zipEntry.async("string");
        const reportSegment = performWebAnalysis(content, zipEntry.name);

        if (reportSegment && reportSegment !== "분석 결과를 찾지 못했습니다.") {
          fullReport += `## 📄 소스: ${zipEntry.name}\n${reportSegment}\n`;
          foundSomething = true;
        }
      }
    }
    return foundSomething
      ? fullReport
      : "ZIP 파일 내에서 분석 결과를 찾지 못했습니다.";
  };

  /**
   * 웹 브라우저 환경에서 단일 코드 내용에 대한 분석을 수행하는 핵심 컨트롤러 함수입니다.
   * @param content 분석할 소스 코드 문자열
   * @param sourceName 코드의 출처 (예: 파일명)
   * @returns 분석 결과를 담은 Markdown 문자열
   */
  const performWebAnalysis = (content: string, sourceName: string): string => {
    setStatusMessage("웹 브라우저에서 분석을 수행합니다...");

    if (analysisMode === "keyword") {
      const parsedKeywords = parseKeywords(keywords);
      if (parsedKeywords.length === 0) return "검색할 키워드를 입력해주세요.";

      const findings = runAdvancedKeywordAnalysis(content, parsedKeywords);

      if (findings.length > 0) {
        const newGraphData = createKeywordGraphData(findings, parsedKeywords);
        setGraphData(newGraphData);

        let report = "";
        findings.forEach((finding) => {
          report += `\n---\n**[함수: ${
            finding.functionName
          }] 키워드 \`${finding.foundKeywords.join(
            ", "
          )}\` 발견**\n\`\`\`javascript\n${finding.content}\n\`\`\`\n`;
        });
        return report;
      }
      return "입력하신 키워드를 소스 코드에서 찾을 수 없습니다.";
    }

    if (analysisMode === "dependency") {
      if (!targetFunction || targetFunction.trim() === "")
        return "분석할 대상 함수의 입력해주세요.";
      const findings = runDependencyAnalysis(content, targetFunction);
      if (!findings) return "AST 분석 중 오류가 발생했습니다.";

      if (findings.target) {
        const newGraphData = createDependencyGraphData(
          targetFunction,
          findings.dependencies
        );
        setGraphData(newGraphData);

        let report = `### 🎯 타겟 함수: \`${targetFunction}\`\n\`\`\`javascript\n${findings.target}\n\`\`\`\n`;
        if (findings.dependencies.length > 0) {
          report += `\n#### 📞 호출하는 함수 목록\n`;
          findings.dependencies.forEach((dep) => {
            report += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
          });
        }
        return report;
      } else {
        return `대상 함수 \`${targetFunction}\`(을)를 찾을 수 없습니다.`;
      }
    }
    return "분석 결과를 찾지 못했습니다.";
  };

  /**
   * 키워드 분석 결과를 바탕으로 React Flow가 사용할 노드와 엣지 데이터를 생성합니다.
   * @param findings 키워드 분석 결과
   * @param keywords 사용자가 검색한 키워드 목록
   * @returns React Flow용 그래프 데이터
   */
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

  /**
   * 의존성 분석 결과를 바탕으로 React Flow가 사용할 노드와 엣지 데이터를 생성합니다.
   * @param target 분석의 시작점이 된 함수 이름
   * @param dependencies 타겟 함수가 호출하는 함수 목록
   * @returns React Flow용 그래프 데이터
   */
  const createDependencyGraphData = (
    target: string,
    dependencies: { name: string }[]
  ): GraphData => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodes.push({
      id: target,
      data: { label: target },
      position: { x: 0, y: 0 },
      type: "input",
      style: {
        backgroundColor: "#DFF4FF",
        borderColor: "#4A90E2",
        width: "auto",
        minWidth: 150,
      },
    });

    dependencies.forEach((dep) => {
      if (!nodes.some((node) => node.id === dep.name)) {
        nodes.push({
          id: dep.name,
          data: { label: dep.name },
          position: { x: 0, y: 0 },
          style: { width: "auto", minWidth: 150 },
        });
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

  /**
   * 분석 결과를 Markdown(.md) 파일로 다운로드하는 함수입니다.
   */
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

  /**
   * 현재 저장된 모든 프리셋을 JSON 파일로 다운로드합니다.
   */
  const handleExportPresets = () => {
    if (presets.length === 0) {
      alert("내보낼 프리셋이 없습니다.");
      return;
    }
    // 프리셋 배열을 보기 좋게 포맷팅된 JSON 문자열로 변환합니다.
    const dataStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "source-analyzer-presets.json";
    a.click(); // 가상 링크를 클릭하여 파일 다운로드 트리거
    URL.revokeObjectURL(url);
    a.remove();
  };

  /**
   * 사용자가 선택한 JSON 파일을 읽어 프리셋을 가져옵니다.
   * @param event 파일 input의 변경 이벤트
   */
  const handleImportPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedPresets: AnalysisPreset[] = JSON.parse(text);

        // 가져온 파일이 유효한 프리셋 형식인지 간단히 검사합니다.
        if (
          !Array.isArray(importedPresets) ||
          !importedPresets.every((p) => p.name && p.mode)
        ) {
          throw new Error("유효하지 않은 프리셋 파일 형식입니다.");
        }

        // 기존 프리셋과 가져온 프리셋을 병합합니다.
        // 이름이 같은 경우, 가져온 프리셋으로 덮어씁니다.
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
          `프리셋을 가져오는 중 오류가 발생했습니다: ${
            (error as Error).message
          }`
        );
      } finally {
        // 같은 파일을 다시 가져올 수 있도록 input의 값을 초기화합니다.
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <Section title='1. 소스 코드 추출기'>
      {/* 사용자 입력을 받는 폼 컴포넌트 */}
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
      {/* 분석 결과 그래프를 표시하는 컴포넌트 (결과가 있을 때만 렌더링) */}
      {graphData.nodes.length > 0 && (
        <DependencyGraph nodes={graphData.nodes} edges={graphData.edges} />
      )}
      {/* 분석 결과 텍스트를 표시하는 컴포넌트 */}
      <ResultDisplay
        isLoading={isLoading}
        statusMessage={statusMessage}
        extractionResult={extractionResult}
        onSaveToFile={handleSaveToFile}
      />
    </Section>
  );
};

export default SourceExtractor;
