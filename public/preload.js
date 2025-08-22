const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    runAnalysis: (options) => ipcRenderer.send('run-analysis', options),
    onAnalysisResult: (callback) => ipcRenderer.on('analysis-result', (event, ...args) => callback(...args)),
    onStatusUpdate: (callback) => ipcRenderer.on('analysis-status-update', (event, ...args) => callback(...args)),
});