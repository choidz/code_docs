// electron/preload.ts

// IpcRendererEvent 타입을 electron에서 가져옵니다.
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // options의 타입을 any로 명시합니다.
  runAnalysis: (options: any) => ipcRenderer.send("run-analysis", options),

  // callback이 함수 타입임을 명시합니다.
  onAnalysisResult: (callback: (...args: any[]) => void) => {
    // event와 args의 타입을 명시합니다.
    const subscription = (event: IpcRendererEvent, ...args: any[]) =>
      callback(...args);
    ipcRenderer.on("analysis-result", subscription);
    return () => {
      ipcRenderer.removeListener("analysis-result", subscription);
    };
  },

  // callback이 함수 타입임을 명시합니다.
  onStatusUpdate: (callback: (message: string) => void) => {
    // event와 args의 타입을 명시합니다.
    const subscription = (event: IpcRendererEvent, message: string) =>
      callback(message);
    ipcRenderer.on("analysis-status-update", subscription);
    return () => {
      ipcRenderer.removeListener("analysis-status-update", subscription);
    };
  },

  // folderPath가 문자열 타입임을 명시합니다.
  generateHeatmapData: (folderPath: string) =>
    ipcRenderer.send("generate-heatmap-data", folderPath),

  // callback이 함수 타입임을 명시합니다.
  onHeatmapDataResult: (callback: (...args: any[]) => void) => {
    // event와 args의 타입을 명시합니다.
    const subscription = (event: IpcRendererEvent, ...args: any[]) =>
      callback(...args);
    ipcRenderer.on("heatmap-data-result", subscription);
    return () => {
      ipcRenderer.removeListener("heatmap-data-result", subscription);
    };
  },
});
