// 1. 우리가 preload.js에서 만든 API의 모양(Shape)을 정의합니다.
export interface IElectronAPI {
  runAnalysis: (options: any) => void,
  onAnalysisResult: (callback: (result: string) => void) => void,
  onStatusUpdate: (callback: (message: string) => void) => void,
}

// 2. 전역(global) window 인터페이스를 확장하여 electronAPI를 추가합니다.
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}