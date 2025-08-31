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

import type {
  AnalysisParams,
  AnalysisResultPayload,
  DependencyFinding,
} from "../src/types";
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
  async (event: IpcMainEvent, options: AnalysisParams): Promise<void> => {
    // 1. 요청 접수 및 상태 업데이트
    event.reply("analysis-status-update", "분석 요청을 접수했습니다...");
    const {
      analysisMode,
      sourceMethod,
      targetFunction,
      pastedCode,
      folderPath,
      filePath,
    } = options;

    try {
      // 2. 소스 메서드에 따라 분석할 파일 목록 생성
      const filesToAnalyze: { name: string; content: string }[] = [];

      if (sourceMethod === "folder") {
        if (!folderPath) throw new Error("폴더 경로를 입력해야 합니다.");
        event.reply(
          "analysis-status-update",
          `'${folderPath}' 폴더를 스캔 중입니다...`
        );
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
        event.reply(
          "analysis-status-update",
          `'${path.basename(filePath)}' 파일을 처리 중입니다...`
        );

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

      if (filesToAnalyze.length === 0) {
        throw new Error("분석할 파일을 찾지 못했습니다.");
      }

      // 3. 파일 목록을 순회하며 분석 실행
      event.reply(
        "analysis-status-update",
        `${filesToAnalyze.length}개 파일에 대한 분석을 시작합니다...`
      );

      const finalResult: AnalysisResultPayload = {
        analysisType: "dependency",
        target: targetFunction,
        findings: [],
      };

      for (const file of filesToAnalyze) {
        let findings: DependencyFinding | null = null;

        switch (analysisMode) {
          case "dependency":
            findings = runDependencyAnalysis(file.content, targetFunction);
            if (findings && findings.target) {
              // ✨ FileFinding<T> 구조에 맞춰 데이터를 추가합니다.
              finalResult.findings.push({ file: file.name, results: findings });
            }
            break;
        }
      }

      // 4. 최종 결과를 렌더러 프로세스로 전송
      event.reply("analysis-status-update", "분석 완료!");
      // ✨ [추가] 보내기 직전 데이터 확인용 로그
      // console.log(
      //   "[MAIN] 🚀 보내는 데이터:",
      //   JSON.stringify(finalResult, null, 2)
      // );

      event.reply("analysis-result", finalResult);
    } catch (error: any) {
      // 5. 오류 발생 시 처리
      // console.error("[Main Process] 분석 중 오류 발생:", error);

      // ✨ [추가] 보내기 직전 에러 데이터 확인용 로그
      const errorPayload = { error: error.message };
      // console.log("[MAIN] 🚀 보내는 에러 데이터:", errorPayload);

      event.reply("analysis-result", errorPayload);
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
      // console.error("히트맵 데이터 생성 오류:", error);
      event.reply("heatmap-data-result", { error: error.message });
    }
  }
);
