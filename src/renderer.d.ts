// types/index.ts에서 AnalysisResultPayload 타입을 가져옵니다.
import type { AnalysisParams, AnalysisResultPayload } from "./types";

export interface IElectronAPI {
  runAnalysis: (options: AnalysisParams) => void;

  // onAnalysisResult의 콜백이 받는 데이터 타입을 string에서 AnalysisResultPayload로 변경합니다.
  onAnalysisResult: (
    callback: (result: AnalysisResultPayload) => void
  ) => () => void;

  onStatusUpdate: (callback: (message: string) => void) => () => void;
  generateHeatmapData: (folderPath: string) => void;
  onHeatmapDataResult: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
