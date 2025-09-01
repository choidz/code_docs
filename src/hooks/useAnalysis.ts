// src/hooks/useAnalysis.ts

import { useEffect, useState } from "react";
import { runWebAnalysis } from "../services/analysisService";
import type { AnalysisParams, AnalysisResultPayload } from "../types";
// ✨ Zustand 스토어와 액션을 가져옵니다.
import { useAnalysisStore, useAnalysisActions } from "../store/analysisStore";

/**
 * 분석 실행 '명령'만 담당하는 오케스트레이터 훅입니다.
 * 실제 상태 관리는 Zustand 스토어에 위임합니다.
 */
export const useAnalysis = () => {
  const [isElectron, setIsElectron] = useState<boolean>(false);
  // ✨ 스토어에서 상태 변경 함수(액션)들을 가져옵니다.
  const { startAnalysis, handleAnalysisResult, setError } = useAnalysisActions();

  useEffect(() => {
    const electronCheck = !!window.electronAPI;
    setIsElectron(electronCheck);

    if (electronCheck) {
      const removeListener = window.electronAPI.onAnalysisResult(
        (result: AnalysisResultPayload | { error: string }) => {
          handleAnalysisResult(result); // 스토어의 액션 호출
        }
      );
      // ... (onStatusUpdate 리스너는 필요 시 스토어에 추가 가능)
      return () => removeListener();
    }
  }, [handleAnalysisResult]);

  const runAnalysis = async (params: AnalysisParams) => {
    startAnalysis(); // 스토어의 액션 호출

    if (isElectron) {
      window.electronAPI.runAnalysis(params);
      return;
    }

    try {
      const finalResult = await runWebAnalysis(params);
      handleAnalysisResult(finalResult); // 스토어의 액션 호출
    } catch (error) {
      setError((error as Error).message); // 스토어의 액션 호출
    }
  };

  return { isElectron, runAnalysis };
};