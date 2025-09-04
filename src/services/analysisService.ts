import JSZip from "jszip";
import { type Edge, type Node } from "reactflow";
import { runDependencyAnalysis } from "../core/analysis";
import type {
  AnalysisParams,
  AnalysisResultPayload,
  DependencyInfo,
  ModuleGraphPayload,
  ReactAnalysisPayload,
} from "../types";
import { createDependencyGraphData } from "./graphService";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

// --- 타입 정의 ---
interface ProcessedResult {
  report: string;
  graphData: {
    nodes: Node[];
    edges: Edge[];
  };
}

// --- 웹 환경을 위한 헬퍼 함수 ---

// Node.js 'path.basename'의 간단한 웹 버전 구현
function basename(path: string): string {
  return path.split('/').pop() || '';
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

/**
 * 웹 브라우저 환경에서 전체 분석 프로세스를 실행합니다.
 */
export const runWebAnalysis = async (
  params: AnalysisParams
): Promise<AnalysisResultPayload | ModuleGraphPayload | ReactAnalysisPayload | null> => {
  const filesToAnalyze: { name: string; content: string; path: string }[] = [];
  if (params.sourceMethod === "paste") {
    if (!params.pastedCode) throw new Error("분석할 소스 코드를 입력해야 합니다.");
    filesToAnalyze.push({ name: "Pasted Code", content: params.pastedCode, path: "pasted.ts" });
  } else if (params.sourceMethod === "upload" && params.selectedFileObject) {
    if (params.selectedFileObject.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(params.selectedFileObject);
      for (const zipEntry of Object.values(zip.files)) {
        if (!zipEntry.dir && /\.(js|jsx|ts|tsx)$/.test(zipEntry.name.toLowerCase())) {
          const content = await zipEntry.async("string");
          filesToAnalyze.push({ name: zipEntry.name, content, path: zipEntry.name });
        }
      }
    } else {
      const content = await params.selectedFileObject.text();
      filesToAnalyze.push({ name: params.selectedFileObject.name, content, path: params.selectedFileObject.name });
    }
  }
  if (filesToAnalyze.length === 0) {
    throw new Error("분석할 파일이 없습니다.");
  }

  // --- 분석 모드에 따른 분기 ---

  if (params.analysisMode === "dependency") {
    const analysisResult = runDependencyAnalysis(filesToAnalyze, params.targetFunction);
    if (!analysisResult || !analysisResult.target) return null;
    const payload: AnalysisResultPayload = {
      analysisType: "dependency",
      // ✨ [오류 수정] .content 접근자를 제거하여 타입 오류를 해결합니다.
      target: analysisResult.target,
      findings: analysisResult.dependencies,
    };
    return payload;
  }
  else if (params.analysisMode === "module") {
    const dependencyMap = new Map<string, string[]>();
    const allFilePaths = new Set(filesToAnalyze.map((f) => f.path));

    for (const file of filesToAnalyze) {
      const dependencies = new Set<string>();
      try {
        const ast = parser.parse(file.content, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: true });
        traverse(ast, {
          ImportDeclaration(p) {
            const importPath = p.node.source.value;
            const absolutePath = resolveVirtualPath(file.path, importPath, allFilePaths);
            if (absolutePath) dependencies.add(absolutePath);
          },
        });
        dependencyMap.set(file.path, Array.from(dependencies));
      } catch (e) {
        console.error(`Error parsing ${file.name}:`, e);
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
      hubs.forEach(hub => { report += `- \`${basename(hub.name)}\` (${hub.count}번 import 됨)\n`; });
      report += `\n`;
    }
    if (orphans.length > 0) {
      report += `### 🗑️ ${orphans.length}개의 고아 모듈 (Orphans)\n`;
      orphans.forEach(orphan => { report += `- \`${basename(orphan)}\`\n`; });
    }
    if (cycles.length === 0 && hubs.length === 0 && orphans.length === 0) {
      report += `👍 발견된 구조적 문제점이 없습니다.`;
    }

    const allPaths = new Set<string>();
    dependencyMap.forEach((deps, path) => {
      allPaths.add(path);
      deps.forEach((dep) => allPaths.add(dep));
    });

    const nodes = Array.from(allPaths).map((file) => ({
      id: file,
      data: { label: file },
      position: { x: Math.random() * 800, y: Math.random() * 600 },
    }));

    const edges: { id: string; source: string; target: string }[] = [];
    dependencyMap.forEach((deps, file) => {
      deps.forEach((dep) => edges.push({ id: `${file}->${dep}`, source: file, target: dep }));
    });

    const payload: ModuleGraphPayload = {
      analysisType: "module-graph",
      nodes,
      edges,
      report,
    };
    return payload;
  }
  return null;
};

/**
 * ZIP 파일 내부의 가상 경로를 해석하는 헬퍼 함수
 */
function resolveVirtualPath(
  importerPath: string,
  importPath: string,
  allFilePaths: Set<string>
): string | null {
  if (!importPath.startsWith(".")) return null;

  const importerDir = importerPath.includes("/") ? importerPath.substring(0, importerPath.lastIndexOf("/")) : "";
  const pathParts = (importerDir ? importerDir + "/" + importPath : importPath).split("/");
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

/**
 * 분석 결과 원본 데이터를 UI에 표시할 리포트와 그래프 데이터로 가공합니다.
 */
export const processAnalysisResult = (
  result: AnalysisResultPayload,
  targetFunctionName: string
): ProcessedResult => {
  const { target, findings } = result;
  let fullReport = `# 📝 분석 결과\n\n`;
  if (target) {
    fullReport += `### 🎯 타겟 함수: \`${targetFunctionName}\`\n\`\`\`javascript\n${target}\n\`\`\`\n\n`;
  }

  const groupedByFile = findings.reduce<Record<string, DependencyInfo[]>>((acc, find) => {
    const key = find.file || "Unknown File";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(find);
    return acc;
  }, {});

  fullReport += `#### 📞 호출하는 함수 목록\n`;
  for (const fileName in groupedByFile) {
    fullReport += `\n## 📄 소스: ${fileName}\n`;
    groupedByFile[fileName].forEach((dep: DependencyInfo) => {
      fullReport += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
    });
  }
  const graphData = createDependencyGraphData(targetFunctionName, findings);
  return { report: fullReport, graphData };
};

