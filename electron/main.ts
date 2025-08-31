// core/main.ts

import { app, BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import isDev from "electron-is-dev";
import fs from "fs";
import { glob } from "glob";
import JSZip from "jszip";
import path from "path";

// 공통 분석 모듈에서 필요한 모든 함수를 가져옵니다.
import {
  calculateComplexity,
  runDependencyAnalysis,
} from "../src/core/analysis";

// --- 타입 정의 ---

interface AnalysisOptions {
  analysisType: "dependency";
  sourceMethod: "folder" | "upload" | "paste";
  keywords: string;
  targetFunction: string;
  pastedCode: string;
  folderPath: string;
  filePath: string;
}

// --- Electron 앱 생명주기 ---

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // package.json의 "main" 필드("build/main.js")를 기준으로 preload.js 경로를 설정해야 합니다.
      // 빌드 과정에서 public/preload.js를 build/preload.js로 복사한다고 가정합니다.
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    // mainWindow.webContents.openDevTools();
  } else {
    // React 빌드 결과물인 index.html의 경로
    mainWindow.loadFile(path.join(__dirname, "../index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// --- IPC 핸들러 ---

// 분석 실행 리스너
ipcMain.on(
  "run-analysis",
  async (event: IpcMainEvent, options: AnalysisOptions): Promise<void> => {
    event.reply("analysis-status-update", "분석 요청을 접수했습니다...");
    const {
      analysisType,
      sourceMethod,
      keywords,
      targetFunction,
      pastedCode,
      folderPath,
      filePath,
    } = options;

    try {
      const filesToAnalyze: { name: string; content: string }[] = [];

      if (sourceMethod === "folder") {
        if (!folderPath) throw new Error("폴더 경로를 입력해야 합니다.");
        const normalizedPath = folderPath.replace(/\\/g, "/");
        const files = await glob(
          `${normalizedPath}/**/*.{js,jsx,ts,tsx,cs,java}`
        );
        files.forEach((file) => {
          filesToAnalyze.push({
            name: path.basename(file),
            content: fs.readFileSync(file, "utf-8"),
          });
        });
      } else if (sourceMethod === "upload") {
        if (!filePath) throw new Error("파일을 선택해야 합니다.");
        if (path.extname(filePath).toLowerCase() === ".zip") {
          const zipData = fs.readFileSync(filePath);
          const zip = await JSZip.loadAsync(zipData);
          for (const fileName in zip.files) {
            const file = zip.files[fileName];
            if (!file.dir) {
              const content = await file.async("string");
              filesToAnalyze.push({ name: file.name, content });
            }
          }
        } else {
          filesToAnalyze.push({
            name: path.basename(filePath),
            content: fs.readFileSync(filePath, "utf-8"),
          });
        }
      } else {
        // "paste"
        if (!pastedCode) throw new Error("분석할 소스 코드를 입력해야 합니다.");
        filesToAnalyze.push({ name: "붙여넣은 코드", content: pastedCode });
      }

      processFiles(filesToAnalyze);
    } catch (error: any) {
      handleError(error);
    }

    function processFiles(files: { name: string; content: string }[]): void {
      const finalResult = {
        analysisType,
        target: targetFunction,
        keywords, // 키워드 정보도 결과에 포함시켜 전달
        findings: [] as any[],
      };

      files.forEach((file) => {
        let findings: any = null;
        switch (analysisType) {
          case "dependency":
            findings = runDependencyAnalysis(file.content, targetFunction);
            if (findings && findings.target) {
              finalResult.findings.push({ file: file.name, ...findings });
            }
            break;
        }
      });
      event.reply("analysis-result", finalResult);
    }

    function handleError(error: Error): void {
      console.error("[Main Process] 분석 중 오류 발생:", error);
      event.reply("analysis-result", { error: error.message });
    }
  }
);

// 히트맵 생성 리스너
ipcMain.on(
  "generate-heatmap-data",
  async (event: IpcMainEvent, folderPath: string): Promise<void> => {
    if (!folderPath) {
      event.reply("heatmap-data-result", { error: "폴더 경로가 필요합니다." });
      return;
    }
    try {
      const normalizedPath = folderPath.replace(/\\/g, "/");
      const files = await glob(
        `${normalizedPath}/**/*.{js,jsx,ts,tsx,cs,java}`
      );
      const root = {
        name: path.basename(normalizedPath),
        children: [] as any[],
      };

      for (const file of files) {
        const relativePath = path
          .relative(normalizedPath, file)
          .replace(/\\/g, "/");
        const parts = relativePath.split("/");
        let currentNode = root;

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          let childNode = currentNode.children.find(
            (child) => child.name === part && child.children
          );
          if (!childNode) {
            childNode = { name: part, children: [] };
            currentNode.children.push(childNode);
          }
          currentNode = childNode;
        }

        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n").length;
        const complexity = calculateComplexity(content);
        currentNode.children.push({
          name: parts[parts.length - 1],
          loc: lines,
          complexity: complexity,
        });
      }
      event.reply("heatmap-data-result", root);
    } catch (error: any) {
      console.error("히트맵 데이터 생성 오류:", error);
      event.reply("heatmap-data-result", { error: error.message });
    }
  }
);
