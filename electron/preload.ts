import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { AnalysisParams, AnalysisResultPayload } from "../src/types";

contextBridge.exposeInMainWorld("electronAPI", {
  runAnalysis: (options: AnalysisParams) =>
    ipcRenderer.send("run-analysis", options),

  // ✨ 이 부분을 수정합니다.
  onAnalysisResult: (
    callback: (result: AnalysisResultPayload | { error: string }) => void
  ) => {
    // ✨ ...args 대신 result라는 이름으로 데이터를 직접 받습니다.
    const subscription = (
      event: IpcRendererEvent,
      result: AnalysisResultPayload | { error: string }
    ) => callback(result); // ✨ result를 그대로 전달합니다.

    ipcRenderer.on("analysis-result", subscription);
    return () => {
      ipcRenderer.removeListener("analysis-result", subscription);
    };
  },

  onStatusUpdate: (callback: (message: string) => void) => {
    const subscription = (event: IpcRendererEvent, message: string) =>
      callback(message);
    ipcRenderer.on("analysis-status-update", subscription);
    return () => {
      ipcRenderer.removeListener("analysis-status-update", subscription);
    };
  },

  generateHeatmapData: (folderPath: string) =>
    ipcRenderer.send("generate-heatmap-data", folderPath),

  // ✨ Heatmap 부분도 동일하게 수정해주는 것이 좋습니다.
  onHeatmapDataResult: (callback: (data: any) => void) => {
    const subscription = (event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on("heatmap-data-result", subscription);
    return () => {
      ipcRenderer.removeListener("heatmap-data-result", subscription);
    };
  },
});
