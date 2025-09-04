import { app, BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import isDev from "electron-is-dev";
import fs from "fs";
import { glob } from "glob";
import JSZip from "jszip";
import path from "path";
import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";

// 공통 분석 모듈에서 필요한 모든 함수를 가져옵니다.
import {
  calculateComplexity,
  runDependencyAnalysis,
} from "../src/core/analysis";

// --- 타입 정의 ---
import type {
  AnalysisParams,
  AnalysisResultPayload,
  ModuleGraphPayload,
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

// --- 분석 헬퍼 함수 ---

// 로컬 파일 시스템의 상대 경로를 절대 경로로 변환
function resolveImportPath(
  importerPath: string,
  importPath: string
): string | null {
  if (!importPath.startsWith(".")) return null;
  const importerDir = path.dirname(importerPath);
  const resolvedPath = path.resolve(importerDir, importPath);
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

// ZIP 파일 내부의 가상 경로 해석
function resolveVirtualPath(
  importerPath: string,
  importPath: string,
  allFilePaths: Set<string>
): string | null {
  if (!importPath.startsWith(".")) return null;
  const importerDir = importerPath.includes("/")
    ? importerPath.substring(0, importerPath.lastIndexOf("/"))
    : "";
  const pathParts = (
    importerDir ? importerDir + "/" + importPath : importPath
  ).split("/");
  const resolvedParts: string[] = [];
  for (const part of pathParts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      resolvedParts.pop();
    } else {
      resolvedParts.push(part);
    }
  }
  const resolvedPath = resolvedParts.join("/");
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
  for (const ext of extensions) {
    const fullPath = resolvedPath + ext;
    if (allFilePaths.has(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

// 순환 의존성 찾기 (DFS 기반)
function findCircularDependencies(dependencyMap: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const detectCycle = (node: string, path: string[]) => {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = dependencyMap.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        detectCycle(neighbor, path);
      } else if (recursionStack.has(neighbor)) {
        cycles.push([...path.slice(path.indexOf(neighbor)), neighbor]);
      }
    }
    path.pop();
    recursionStack.delete(node);
  }

  dependencyMap.forEach((_, node) => {
    if (!visited.has(node)) {
      detectCycle(node, []);
    }
  });
  return cycles;
}

// 핵심 모듈 (Hub) 찾기
function findHubModules(dependencyMap: Map<string, string[]>, threshold: number = 5): { name: string, count: number }[] {
  const importCounts: Record<string, number> = {};
  dependencyMap.forEach((dependencies) => {
    for (const dep of dependencies) {
      importCounts[dep] = (importCounts[dep] || 0) + 1;
    }
  });
  return Object.entries(importCounts)
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

// 고아 모듈 (Orphan) 찾기
function findOrphanModules(dependencyMap: Map<string, string[]>): string[] {
  const allDependencies = new Set<string>();
  dependencyMap.forEach((dependencies) => {
    dependencies.forEach(dep => allDependencies.add(dep));
  });
  const orphans: string[] = [];
  dependencyMap.forEach((dependencies, file) => {
    if (!allDependencies.has(file) && dependencies.length > 0) {
      if (!file.includes('index.') && !file.includes('main.') && !file.includes('App.')) {
        orphans.push(file);
      }
    }
  });
  return orphans;
}

// ✨ [신규] React 컴포넌트 분석 헬퍼 함수
function analyzeReactComponents(filesToAnalyze: { name: string; content: string; path: string }[]): { tree: any[], godComponents: any[] } {
  const componentChildrenMap = new Map<string, Set<string>>();
  const allComponents = new Set<string>();
  const componentMetrics = new Map<string, any>();

  const GOD_COMPONENT_THRESHOLDS = { hooks: 8, props: 10, loc: 150, complexity: 15 };

  for (const file of filesToAnalyze) {
    if (!/\.(tsx|jsx)$/.test(file.path.toLowerCase())) continue;

    try {
      const ast = parser.parse(file.content, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: true });

      // ✨ [오류 수정] 파라미터 이름을 'path'에서 'nodePath'로 변경하여 변수 이름 충돌을 해결합니다.
      const findDataInPath = (nodePath: NodePath) => {
        let parentComponentName: string | null = null;
        const node = nodePath.node as any;

        if (node.id) { // function MyComponent() {}
          parentComponentName = node.id.name;
        } else if (nodePath.parentPath && nodePath.parentPath.isVariableDeclarator() && (nodePath.parent as any).id.type === 'Identifier') { // const MyComponent = () => {}
          parentComponentName = (nodePath.parent as any).id.name;
          // ✨ [버그 수정] 이름 없는 export default 함수를 파일 이름으로 인식하도록 추가
        } else if (nodePath.parentPath && nodePath.parentPath.isExportDefaultDeclaration()) {
          // ✨ [오류 수정] Node.js의 'path' 모듈을 올바르게 사용합니다.
          parentComponentName = path.basename(file.path, path.extname(file.path));
        }

        if (!parentComponentName || !/^[A-Z]/.test(parentComponentName)) return;

        allComponents.add(parentComponentName);
        const children = new Set<string>();

        const loc = node.loc ? node.loc.end.line - node.loc.start.line : 0;
        const complexity = calculateComplexity(file.content.slice(node.start, node.end));
        let hooksCount = 0;
        let propsCount = 0;

        if (node.params && node.params[0] && node.params[0].type === 'ObjectPattern') {
          propsCount = node.params[0].properties.length;
        }

        nodePath.traverse({
          CallExpression(callPath) {
            if ((callPath.node.callee as any).name?.startsWith('use')) hooksCount++;
          },
          JSXOpeningElement(jsxPath) {
            const jsxNodeName = (jsxPath.node.name as any).name;
            if (jsxNodeName && /^[A-Z]/.test(jsxNodeName)) {
              children.add(jsxNodeName);
              allComponents.add(jsxNodeName);
            }
          }
        });

        componentMetrics.set(parentComponentName, { loc, complexity, hooksCount, propsCount, path: file.path });

        const existingChildren = componentChildrenMap.get(parentComponentName) || new Set();
        children.forEach(child => existingChildren.add(child));
        componentChildrenMap.set(parentComponentName, existingChildren);
      };

      traverse(ast, {
        FunctionDeclaration(path) { findDataInPath(path); },
        ArrowFunctionExpression(path) { findDataInPath(path); },
        FunctionExpression(path) { findDataInPath(path); }
      });
    } catch (e) {
      console.error(`Error parsing for React components in ${file.path}:`, e);
    }
  }

  const godComponents: any[] = [];
  componentMetrics.forEach((metrics, name) => {
    if (metrics.loc > GOD_COMPONENT_THRESHOLDS.loc || metrics.complexity > GOD_COMPONENT_THRESHOLDS.complexity || metrics.hooksCount > GOD_COMPONENT_THRESHOLDS.hooks || metrics.propsCount > GOD_COMPONENT_THRESHOLDS.props) {
      godComponents.push({ name, ...metrics });
    }
  });

  const allChildren = new Set<string>();
  componentChildrenMap.forEach(children => children.forEach(child => allChildren.add(child)));
  const rootNodes = new Set<string>();
  allComponents.forEach(component => {
    if (!allChildren.has(component)) rootNodes.add(component);
  });

  const buildTree = (componentName: string): any => {
    const childrenSet = componentChildrenMap.get(componentName) || new Set();
    const children = Array.from(childrenSet).map(child => buildTree(child));
    return { name: componentName, children };
  }

  const tree = Array.from(rootNodes).map(root => buildTree(root));
  return { tree, godComponents };
}


// --- IPC 핸들러 ---

ipcMain.on(
  "run-analysis",
  async (event: IpcMainEvent, options: AnalysisParams): Promise<void> => {
    event.reply("analysis-status-update", "분석 요청을 접수했습니다...");
    const { analysisMode, sourceMethod, targetFunction, pastedCode, folderPath, filePath } = options;

    try {
      // --- 1. 파일 준비 (모든 분석 모드 공통) ---
      const filesToAnalyze: { name: string; content: string; path: string }[] = [];

      if (sourceMethod === "folder") {
        if (!folderPath) throw new Error("폴더 경로를 입력해야 합니다.");
        event.reply("analysis-status-update", `'${folderPath}' 폴더를 스캔 중입니다...`);
        const filePaths = await glob(`${folderPath.replace(/\\/g, "/")}/**/*.{js,jsx,ts,tsx}`, { ignore: "**/node_modules/**", absolute: true });
        filePaths.forEach((p) => {
          filesToAnalyze.push({
            name: path.basename(p),
            content: fs.readFileSync(p, "utf-8"),
            path: p,
          });
        });
      } else if (sourceMethod === "upload") {
        if (!filePath) throw new Error("파일을 선택해야 합니다.");
        event.reply("analysis-status-update", `'${path.basename(filePath)}' 파일을 처리 중입니다...`);
        if (path.extname(filePath).toLowerCase() === ".zip") {
          const zipData = fs.readFileSync(filePath);
          const zip = await JSZip.loadAsync(zipData);
          for (const fileName in zip.files) {
            const file = zip.files[fileName];
            if (!file.dir && /\.(js|jsx|ts|tsx)$/.test(fileName.toLowerCase())) {
              const content = await file.async("string");
              filesToAnalyze.push({ name: fileName, content, path: fileName });
            }
          }
        } else {
          filesToAnalyze.push({
            name: path.basename(filePath),
            content: fs.readFileSync(filePath, "utf-8"),
            path: filePath,
          });
        }
      } else { // sourceMethod === 'paste'
        if (!pastedCode) throw new Error("분석할 소스 코드를 입력해야 합니다.");
        filesToAnalyze.push({ name: "Pasted Code", content: pastedCode, path: "pasted.ts" });
      }

      if (filesToAnalyze.length === 0) {
        throw new Error("분석할 소스 코드 파일을 찾지 못했습니다.");
      }

      // --- 2. 분석 모드에 따라 분기 ---

      if (analysisMode === "module") {
        if (sourceMethod === "paste") throw new Error("모듈 분석은 코드 붙여넣기를 지원하지 않습니다.");
        event.reply("analysis-status-update", "모듈 의존성을 분석합니다...");

        const dependencyMap = new Map<string, string[]>();
        const allFilePathsSet = new Set(filesToAnalyze.map((f) => f.path));

        for (const file of filesToAnalyze) {
          const dependencies = new Set<string>();
          try {
            const ast = parser.parse(file.content, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: true });
            traverse(ast, {
              ImportDeclaration(p) {
                const importPath = p.node.source.value;
                const absolutePath = sourceMethod === "folder" ? resolveImportPath(file.path, importPath) : resolveVirtualPath(file.path, importPath, allFilePathsSet);
                if (absolutePath) dependencies.add(absolutePath);
              },
            });
            dependencyMap.set(file.path, Array.from(dependencies));
          } catch (e) {
            console.error(`Error parsing ${file.path}:`, e);
          }
        }

        const cycles = findCircularDependencies(dependencyMap);
        const hubs = findHubModules(dependencyMap);
        const orphans = findOrphanModules(dependencyMap);

        let report = `✅ 총 ${dependencyMap.size}개의 모듈을 분석했습니다.\n\n`;
        if (cycles.length > 0) {
          report += `### 🚨 ${cycles.length}개의 순환 의존성 발견\n`;
          cycles.forEach(cycle => { report += `- \`${cycle.join(' -> ')}\`\n`; });
          report += `\n`;
        }
        if (hubs.length > 0) {
          report += `### 🌟 ${hubs.length}개의 핵심 모듈 (Hubs)\n`;
          hubs.forEach(hub => { report += `- \`${path.basename(hub.name)}\` (${hub.count}번 import 됨)\n`; });
          report += `\n`;
        }
        if (orphans.length > 0) {
          report += `### 🗑️ ${orphans.length}개의 고아 모듈 (Orphans)\n`;
          orphans.forEach(orphan => { report += `- \`${path.basename(orphan)}\`\n`; });
        }
        if (cycles.length === 0 && hubs.length === 0 && orphans.length === 0) {
          report += `👍 발견된 구조적 문제점이 없습니다.`;
        }

        const allPaths = new Set<string>();
        dependencyMap.forEach((deps, path) => {
          allPaths.add(path);
          deps.forEach((dep) => allPaths.add(dep));
        });

        const normalizedPath = sourceMethod === 'folder' ? folderPath.replace(/\\/g, "/") : '';
        const nodes = Array.from(allPaths).map((file) => ({
          id: file,
          data: { label: sourceMethod === "folder" ? path.relative(normalizedPath, file).replace(/\\/g, "/") : file },
          position: { x: Math.random() * 800, y: Math.random() * 600 },
        }));
        const edges: { id: string; source: string; target: string }[] = [];
        dependencyMap.forEach((deps, file) => {
          deps.forEach((dep) => edges.push({ id: `${file}->${dep}`, source: file, target: dep }));
        });

        const payload: ModuleGraphPayload = { analysisType: "module-graph", nodes, edges, report };
        event.reply("analysis-status-update", "분석 완료!");
        event.reply("analysis-result", payload);

      } else if (analysisMode === "react-analysis") {
        event.reply("analysis-status-update", "React 컴포넌트를 분석합니다...");

        const { tree, godComponents } = analyzeReactComponents(filesToAnalyze);

        // --- 🕵️ 디버깅 콘솔 로그 ---
        console.log("[Main] React 분석 결과 (트리, 거대 컴포넌트):", { tree, godComponents });

        let report = `✅ 총 ${tree.length}개의 루트 컴포넌트 트리를 분석했습니다.\n\n`;

        const printTree = (node: any, prefix = ''): string => {
          let result = `${prefix}└─ ${node.name}\n`;
          node.children.forEach((child: any, index: number) => {
            const isLast = index === node.children.length - 1;
            result += printTree(child, `${prefix}${isLast ? '   ' : '│  '}`);
          });
          return result;
        }

        tree.forEach((root: any) => {
          report += `### 🌳 ${root.name} 컴포넌트 트리\n`;
          report += `\`\`\`\n${printTree(root)}\`\`\`\n`;
        });

        if (godComponents.length > 0) {
          report += `\n### 🐘 ${godComponents.length}개의 거대 컴포넌트(God Component) 발견\n`;
          godComponents.forEach(comp => {
            report += `- **${comp.name}** (${path.basename(comp.path)})\n`;
            report += `  - 코드 라인: ${comp.loc}, 복잡도: ${comp.complexity}, Hooks: ${comp.hooksCount}, Props: ${comp.propsCount}\n`;
          });
        }

        // --- 🕵️ 디버깅 콘솔 로그 ---
        console.log("[Main] 최종 생성된 React 분석 리포트:", report);

        const payload = { analysisType: 'react-analysis', tree, godComponents, report };

        // --- 🕵️ 디버깅 콘솔 로그 ---
        console.log("[Main] 렌더러로 전송할 최종 데이터 (payload):", payload);

        event.reply("analysis-status-update", "분석 완료!");
        event.reply("analysis-result", payload);

      } else if (analysisMode === "dependency") {
        event.reply("analysis-status-update", `${filesToAnalyze.length}개 파일에 대한 분석을 시작합니다...`);
        const analysisResult = runDependencyAnalysis(filesToAnalyze, targetFunction);
        const payload: AnalysisResultPayload = {
          analysisType: "dependency",
          target: analysisResult?.target || null,
          findings: analysisResult?.dependencies || [],
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
        `${normalizedPath}/**/*.{js,jsx|ts,tsx,cs,java}`
      );
      const root = { name: path.basename(normalizedPath), children: [] as any[] };
      for (const file of files) {
        const relativePath = path.relative(normalizedPath, file).replace(/\\/g, "/");
        const parts = relativePath.split("/");
        let currentNode = root;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          let childNode = currentNode.children.find((child) => child.name === part && child.children);
          if (!childNode) {
            childNode = { name: part, children: [] };
            currentNode.children.push(childNode);
          }
          currentNode = childNode;
        }
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n").length;
        const complexity = calculateComplexity(content);
        currentNode.children.push({ name: parts[parts.length - 1], loc: lines, complexity: complexity });
      }
      event.reply("heatmap-data-result", root);
    } catch (error: any) {
      event.reply("heatmap-data-result", { error: error.message });
    }
  }
);

