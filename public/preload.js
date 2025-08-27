const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  runAnalysis: (options) => ipcRenderer.send("run-analysis", options),

  // ▼▼▼ [수정] 아래 리스너들이 모두 정리 함수를 반환하도록 변경 ▼▼▼
  onAnalysisResult: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on("analysis-result", subscription);
    return () => {
      ipcRenderer.removeListener("analysis-result", subscription);
    };
  },
  onStatusUpdate: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on("analysis-status-update", subscription);
    return () => {
      ipcRenderer.removeListener("analysis-status-update", subscription);
    };
  },
  generateHeatmapData: (folderPath) =>
    ipcRenderer.send("generate-heatmap-data", folderPath),
  onHeatmapDataResult: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on("heatmap-data-result", subscription);
    return () => {
      ipcRenderer.removeListener("heatmap-data-result", subscription);
    };
  },
});
