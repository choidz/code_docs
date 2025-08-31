import { useEffect, useState } from "react";
import { type Edge, type Node } from "reactflow";
import {
  processAnalysisResult,
  runWebAnalysis,
} from "../services/analysisService";
import type { AnalysisParams, AnalysisResultPayload } from "../types";

interface GraphData {
  nodes: Node[];
  edges: Edge[];
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

  const handleAnalysisResult = (
    result: AnalysisResultPayload | { error: string } | null
  ) => {
    // 1. null 또는 undefined인 경우 처리
    if (!result) {
      setExtractionResult("분석 결과를 찾지 못했습니다.");
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    // 2. 에러 객체인 경우를 명확하게 확인하고 처리
    //    'error' in result 구문이 TypeScript에게 타입을 확신시켜주는 핵심입니다.
    if ("error" in result) {
      setExtractionResult(
        `# ❗ 분석 중 오류가 발생했습니다.\n\n${result.error}`
      );
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    // 3. 위 관문을 통과했다면, 이 아래부터 result는 무조건 AnalysisResultPayload 타입입니다.
    //    이제 .findings 속성에 안전하게 접근할 수 있습니다.
    if (result.findings.length === 0) {
      setExtractionResult("분석 결과를 찾지 못했습니다.");
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    // 4. 성공적인 결과만 가공하여 상태 업데이트
    const { report, graphData: newGraphData } = processAnalysisResult(result);
    setExtractionResult(report);
    setGraphData(newGraphData);
  };

  useEffect(() => {
    const electronCheck = !!window.electronAPI;
    setIsElectron(electronCheck);

    if (electronCheck) {
      const removeListener = window.electronAPI.onAnalysisResult(
        (result: AnalysisResultPayload | { error: string }) => {
          // ✨ [추가] 받자마자 데이터 확인용 로그
          console.log("[RENDERER] 📦 받은 데이터:", result);
          setIsLoading(false);
          setStatusMessage("");
          handleAnalysisResult(result);
        }
      );
      const removeStatusListener = window.electronAPI.onStatusUpdate(
        (message: string) => {
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
      setStatusMessage("웹 환경에서 분석을 시작합니다...");
      const finalResult = await runWebAnalysis(params);
      handleAnalysisResult(finalResult);
    } catch (error) {
      handleAnalysisResult({ error: (error as Error).message });
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
