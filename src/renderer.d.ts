export interface IElectronAPI {
  runAnalysis: (options: any) => void;

  // ▼▼▼ [수정] 모든 리스너 함수의 반환 타입을 () => void로 변경 ▼▼▼
  onAnalysisResult: (callback: (result: string) => void) => () => void;
  onStatusUpdate: (callback: (message: string) => void) => () => void;

  generateHeatmapData: (folderPath: string) => void;
  onHeatmapDataResult: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
