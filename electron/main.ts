// core/main.ts

import { app, BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import isDev from "electron-is-dev";
import fs from "fs";
import { glob } from "glob";
import JSZip from "jszip";
import path from "path";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

// 공통 분석 모듈에서 필요한 모든 함수를 가져옵니다.
import {
  calculateComplexity,
  runDependencyAnalysis,
} from "../src/core/analysis";

// --- 타입 정의 ---

import type {
  AnalysisParams,
  AnalysisResultPayload,
  // DependencyFinding,
} from "../src/types";
// --- Electron 앱 생명주기 ---

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../index.html")}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
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

// ✨ [모듈 분석 추가] 상대 경로를 절대 경로로 변환하는 헬퍼 함수
// './utils' => '/path/to/project/src/utils.ts'
function resolveImportPath(
  importerPath: string,
  importPath: string
): string | null {
  // 라이브러리(react, electron 등) 임포트는 분석에서 제외
  if (!importPath.startsWith(".")) {
    return null;
  }

  const importerDir = path.dirname(importerPath);
  const resolvedPath = path.resolve(importerDir, importPath);

  // 시도할 확장자 목록
  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  const filesToCheck = [
    resolvedPath,
    ...extensions.map((ext) => resolvedPath + ext),
    path.join(resolvedPath, "index.ts"),
    path.join(resolvedPath, "index.tsx"),
    path.join(resolvedPath, "index.js"),
    path.join(resolvedPath, "index.jsx"),
  ];

  for (const file of filesToCheck) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      return file;
    }
  }

  return null;
}

// 분석 실행 리스너
ipcMain.on(
  "run-analysis",
  async (event: IpcMainEvent, options: AnalysisParams): Promise<void> => {
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
      // ✨ [모듈 분석 추가] 모듈 분석은 'folder' 모드에서만 동작하므로 먼저 처리
      if (analysisMode === "module") {
        if (sourceMethod !== "folder" || !folderPath) {
          throw new Error("모듈 분석은 폴더 선택 모드에서만 사용할 수 있습니다.");
        }
        event.reply(
          "analysis-status-update",
          `'${folderPath}' 폴더의 모듈 의존성을 분석합니다...`
        );
        const normalizedPath = folderPath.replace(/\\/g, "/");

        const allFiles = await glob(`${normalizedPath}/**/*.{js,jsx,ts,tsx}`, {
          ignore: "**/node_modules/**",
          absolute: true,
        });

        const dependencyMap = new Map<string, string[]>();

        for (const file of allFiles) {
          const content = fs.readFileSync(file, "utf-8");
          const dependencies = new Set<string>();
          try {
            const ast = parser.parse(content, {
              sourceType: "module",
              plugins: ["typescript", "jsx"],
            });
            traverse(ast, {
              ImportDeclaration(p) {
                const importPath = p.node.source.value;
                const absolutePath = resolveImportPath(file, importPath);
                if (absolutePath) {
                  dependencies.add(absolutePath);
                }
              },
            });
            dependencyMap.set(file, Array.from(dependencies));
          } catch (e) {
            console.error(`Error parsing ${file}:`, e);
          }
        }

        // --- ✨ [수정된 부분 시작] ---
        // 1. 모든 파일 경로(중복 포함)를 담을 배열을 생성합니다.
        const allFilePaths: string[] = [];
        dependencyMap.forEach((dependencies, file) => {
          allFilePaths.push(file); // 'import' 하는 파일 추가
          dependencies.forEach(dep => {
            allFilePaths.push(dep); // 'import' 되는 파일들 추가
          });
        });

        // 2. 중복을 제거하여 유니크한 파일 경로 배열을 만듭니다.
        const uniqueFilePaths = allFilePaths.filter((file, index, self) => {
          return self.indexOf(file) === index;
        });

        // 3. 유니크한 경로 배열을 기반으로 노드를 생성합니다.
        const nodes = uniqueFilePaths.map((file) => ({
          id: file,
          data: { label: path.relative(normalizedPath, file).replace(/\\/g, "/") },
          position: { x: Math.random() * 800, y: Math.random() * 600 },
        }));
        // --- ✨ [수정된 부분 끝] ---

        const edges: { id: string; source: string; target: string }[] = [];
        dependencyMap.forEach((deps, file) => {
          for (const dep of deps) {
            edges.push({
              id: `${file}->${dep}`,
              source: file,
              target: dep,
            });
          }
        });

        event.reply("analysis-status-update", "분석 완료!");
        event.reply("analysis-result", {
          analysisType: "module-graph",
          nodes,
          edges,
        });
        return; // 모듈 분석은 여기서 종료
      }

      // --- 기존 분석 로직 (함수 단위 의존성 등) ---
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

      event.reply(
        "analysis-status-update",
        `${filesToAnalyze.length}개 파일에 대한 분석을 시작합니다...`
      );

      // const finalResult: AnalysisResultPayload = {
      //   analysisType: "dependency",
      //   target: targetFunction,
      //   findings: [],
      // };

      // for (const file of filesToAnalyze) {
      //   let findings: DependencyFinding | null = null;

      //   switch (analysisMode) {
      //     case "dependency":
      //       findings = runDependencyAnalysis(file.content, targetFunction);
      //       if (findings && findings.target) {
      //         finalResult.findings.push({ file: file.name, results: findings });
      //       }
      //       break;
      //   }
      // }

      // event.reply("analysis-status-update", "분석 완료!");
      // event.reply("analysis-result", finalResult);
      // ✨ [수정] analysisMode가 'dependency'일 때만 이 로직을 실행합니다.
      if (analysisMode === "dependency") {
        // ✨ [핵심] 파일 배열 전체를 한번에 넘겨 분석을 실행합니다.
        const analysisResult = runDependencyAnalysis(filesToAnalyze, targetFunction);

        // ✨ 새로운 분석 결과 구조에 맞춰 프론트엔드로 보낼 데이터를 재구성합니다.
        const payload: AnalysisResultPayload = {
          analysisType: "dependency",
          target: analysisResult?.target || null,
          // ✨ analysis.ts의 DependencyInfo[] 타입을 그대로 전달합니다.
          //    (타입 호환을 위해 as any 사용, 추후 types/index.ts 수정 권장)
          findings: (analysisResult?.dependencies as any) || []
        };

        event.reply("analysis-status-update", "분석 완료!");
        event.reply("analysis-result", payload);
      }
    } catch (error: any) {
      const errorPayload = { error: error.message };
      event.reply("analysis-result", errorPayload);
    }
  }
);

// 히트맵 생성 리스너 (변경 없음)
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
      event.reply("heatmap-data-result", { error: error.message });
    }
  }
);
