import { useEffect, useState, useRef } from "react";
import { runWebAnalysis } from "../services/analysisService";
import type {
  AnalysisParams,
  AnalysisResultPayload,
  ModuleGraphPayload,
} from "../types";
// ✨ Zustand 스토어와 액션을 가져옵니다.
import { useAnalysisActions } from "../store/analysisStore";

/**
 * 분석 실행 '명령'만 담당하는 오케스트레이터 훅입니다.
 * 실제 상태 관리는 Zustand 스토어에 위임합니다.
 */
export const useAnalysis = () => {
  const [isElectron, setIsElectron] = useState<boolean>(false);
  // ✨ 스토어에서 상태 변경 함수(액션)들을 가져옵니다.
  const { startAnalysis, handleAnalysisResult, setError } = useAnalysisActions();

  // ✨ [추가] Electron의 비동기 응답이 왔을 때, 어떤 함수에 대한 결과인지 알려주기 위해
  //      타겟 함수 이름을 저장할 ref를 생성합니다.
  const currentTargetFunction = useRef<string>("");

  useEffect(() => {
    const electronCheck = !!window.electronAPI;
    setIsElectron(electronCheck);

    if (electronCheck) {
      // ✨ [수정] handleAnalysisResult 호출 시 ref에 저장된 타겟 함수 이름을 함께 전달합니다.
      const removeListener = window.electronAPI.onAnalysisResult(
        (
          result:
            | AnalysisResultPayload
            | ModuleGraphPayload
            | { error: string }
        ) => {
          handleAnalysisResult(result, currentTargetFunction.current); // 스토어의 액션 호출
        }
      );
      // ... (onStatusUpdate 리스너는 필요 시 스토어에 추가 가능)
      return () => removeListener();
    }
  }, [handleAnalysisResult]);

  const runAnalysis = async (params: AnalysisParams) => {
    // ✨ [추가] 분석을 시작할 때 ref에 현재 타겟 함수 이름을 저장합니다.
    currentTargetFunction.current = params.targetFunction;
    startAnalysis(); // 스토어의 액션 호출

    if (isElectron) {
      window.electronAPI.runAnalysis(params);
      return;
    }

    try {
      const finalResult = await runWebAnalysis(params);
      // ✨ [수정] handleAnalysisResult 호출 시 params에서 타겟 함수 이름을 함께 전달합니다.
      handleAnalysisResult(finalResult, params.targetFunction); // 스토어의 액션 호출
    } catch (error) {
      setError((error as Error).message); // 스토어의 액션 호출
    }
  };

  return { isElectron, runAnalysis };
};
