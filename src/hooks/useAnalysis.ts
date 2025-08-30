import JSZip from "jszip";
import { useEffect, useState } from "react";
import { type Edge, type Node } from "reactflow";
import {
  parseKeywords,
  runAdvancedKeywordAnalysis,
  runCallHierarchyAnalysis,
  runDependencyAnalysis,
} from "../core/analysis";
import {
  createCallHierarchyGraphData,
  createDependencyGraphData,
  createKeywordGraphData,
} from "../services/graphService";

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface AnalysisParams {
  analysisMode: "keyword" | "dependency" | "heatmap" | "callHierarchy";
  keywords: string;
  shouldExtractBlocks: boolean;
  targetFunction: string;
  sourceMethod: "paste" | "upload" | "folder";
  pastedCode: string;
  folderPath: string;
  filePath: string;
  selectedFileObject: File | null;
}

export const useAnalysis = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [extractionResult, setExtractionResult] = useState<string>("");
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    edges: [],
  });
  const [isElectron, setIsElectron] = useState<boolean>(false);

  const processAnalysisResult = (result: any) => {
    if (!result || !result.findings || result.findings.length === 0) {
      setExtractionResult("분석 결과를 찾지 못했습니다.");
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    let fullReport = `# 📝 분석 결과\n\n`;
    let newGraphData: GraphData = { nodes: [], edges: [] };

    result.findings.forEach((findingGroup: any) => {
      fullReport += `## 📄 소스: ${findingGroup.file}\n`;

      switch (result.analysisType) {
        case "dependency":
          const { target, dependencies } = findingGroup;
          newGraphData = createDependencyGraphData(result.target, dependencies);
          fullReport += `### 🎯 타겟 함수: \`${result.target}\`\n\`\`\`javascript\n${target}\n\`\`\`\n`;
          if (dependencies.length > 0) {
            fullReport += `\n#### 📞 호출하는 함수 목록\n`;
            dependencies.forEach((dep: any) => {
              fullReport += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
            });
          }
          break;
        case "callHierarchy":
          const { callers } = findingGroup;
          newGraphData = createCallHierarchyGraphData(result.target, callers);
          fullReport += `### 📞 \`${result.target}\` 함수를 호출하는 함수 목록\n`;
          callers.forEach((caller: any) => {
            fullReport += `\n* **\`${caller.name}\`**\n\`\`\`javascript\n${caller.content}\n\`\`\`\n`;
          });
          break;
        case "keyword":
          const { results } = findingGroup;
          // Note: `keywords` state is not directly available here. We pass it during analysis.
          const parsedKeywords = parseKeywords(result.keywords);
          newGraphData = createKeywordGraphData(results, parsedKeywords);
          results.forEach((finding: any) => {
            fullReport += `\n---\n**[함수: ${
              finding.functionName
            }] 키워드 \`${finding.foundKeywords.join(
              ", "
            )}\` 발견**\n\`\`\`javascript\n${finding.content}\n\`\`\`\n`;
          });
          break;
      }
    });

    setExtractionResult(fullReport);
    setGraphData(newGraphData);
  };

  useEffect(() => {
    const electronCheck = !!window.electronAPI;
    setIsElectron(electronCheck);
    if (electronCheck) {
      const removeListener = window.electronAPI.onAnalysisResult(
        (result: any) => {
          setIsLoading(false);
          setStatusMessage("");
          processAnalysisResult(result);
        }
      );
      const removeStatusListener = window.electronAPI.onStatusUpdate(
        (message) => {
          setStatusMessage(message);
        }
      );
      return () => {
        removeListener();
        removeStatusListener();
      };
    }
  }, []);

  const runAnalysis = async (params: AnalysisParams) => {
    setIsLoading(true);
    setExtractionResult("");
    setStatusMessage("");
    setGraphData({ nodes: [], edges: [] });

    if (isElectron) {
      window.electronAPI.runAnalysis(params);
      return;
    }

    try {
      if (params.sourceMethod === "folder") {
        throw new Error("폴더 분석은 데스크톱 앱에서만 지원됩니다.");
      }

      setStatusMessage("분석할 파일을 준비 중입니다...");
      const filesToAnalyze: { name: string; content: string }[] = [];

      if (params.sourceMethod === "paste") {
        if (!params.pastedCode)
          throw new Error("분석할 소스 코드를 입력해야 합니다.");
        filesToAnalyze.push({
          name: "붙여넣은 코드",
          content: params.pastedCode,
        });
      } else if (
        params.sourceMethod === "upload" &&
        params.selectedFileObject
      ) {
        if (params.selectedFileObject.name.toLowerCase().endsWith(".zip")) {
          const zip = await JSZip.loadAsync(params.selectedFileObject);
          for (const zipEntry of Object.values(zip.files)) {
            if (!zipEntry.dir) {
              const content = await zipEntry.async("string");
              filesToAnalyze.push({ name: zipEntry.name, content });
            }
          }
        } else {
          const content = await params.selectedFileObject.text();
          filesToAnalyze.push({
            name: params.selectedFileObject.name,
            content,
          });
        }
      }

      if (filesToAnalyze.length === 0) {
        throw new Error("분석할 파일이 없습니다.");
      }

      setStatusMessage(
        `${filesToAnalyze.length}개 파일에 대한 분석을 시작합니다...`
      );
      const finalResult: any = {
        analysisType: params.analysisMode,
        target: params.targetFunction,
        keywords: params.keywords, // 키워드 정보를 결과 객체에 포함시켜 전달
        findings: [],
      };

      for (const file of filesToAnalyze) {
        let findings: any = null;
        switch (params.analysisMode) {
          case "keyword":
            const parsed = parseKeywords(params.keywords);
            if (parsed.length > 0) {
              const results = runAdvancedKeywordAnalysis(file.content, parsed);
              if (results && results.length > 0) findings = { results };
            }
            break;
          case "dependency":
            if (params.targetFunction) {
              const result = runDependencyAnalysis(
                file.content,
                params.targetFunction
              );
              if (result && result.target) findings = result;
            }
            break;
          case "callHierarchy":
            if (params.targetFunction) {
              const result = runCallHierarchyAnalysis(
                file.content,
                params.targetFunction
              );
              if (result && result.callers.length > 0) findings = result;
            }
            break;
        }
        if (findings) {
          finalResult.findings.push({ file: file.name, ...findings });
        }
      }

      processAnalysisResult(finalResult);
    } catch (error) {
      setExtractionResult(
        "# ❗ 분석 중 오류가 발생했습니다.\n\n" + (error as Error).message
      );
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  return {
    isLoading,
    statusMessage,
    extractionResult,
    graphData,
    isElectron,
    runAnalysis,
  };
};
