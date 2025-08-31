// src/services/analysisService.ts

import JSZip from "jszip";
import { type Edge, type Node } from "reactflow";
import type { DependencyAnalysisResult } from "../core/analysis";
import { runDependencyAnalysis } from "../core/analysis";
import { createDependencyGraphData } from "./graphService";
// ✨ 중앙 관리되는 타입들을 모두 가져옵니다.
import type {
  AnalysisParams,
  AnalysisResultPayload,
  DependencyFinding,
  DependencyInfo,
  FileFinding,
} from "../types";

// UI가 사용할 최종 결과물의 타입 정의
interface ProcessedResult {
  report: string;
  graphData: {
    nodes: Node[];
    edges: Edge[];
  };
}

/**
 * 웹 브라우저 환경에서 전체 분석 프로세스를 실행합니다.
 * @param params 분석에 필요한 모든 파라미터
 * @returns 분석 결과 데이터
 */
export const runWebAnalysis = async (
  params: AnalysisParams
): Promise<AnalysisResultPayload | null> => {
  if (params.sourceMethod === "folder") {
    throw new Error("폴더 분석은 데스크톱 앱에서만 지원됩니다.");
  }

  const filesToAnalyze: { name: string; content: string }[] = [];

  if (params.sourceMethod === "paste") {
    if (!params.pastedCode)
      throw new Error("분석할 소스 코드를 입력해야 합니다.");
    filesToAnalyze.push({ name: "붙여넣은 코드", content: params.pastedCode });
  } else if (params.sourceMethod === "upload" && params.selectedFileObject) {
    if (params.selectedFileObject.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(params.selectedFileObject);
      for (const zipEntry of Object.values(zip.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async("string");
          filesToAnalyze.push({ name: zipEntry.name, content });
        }
      }
    } else {
      const content = await params.selectedFileObject.text();
      filesToAnalyze.push({ name: params.selectedFileObject.name, content });
    }
  }

  if (filesToAnalyze.length === 0) {
    throw new Error("분석할 파일이 없습니다.");
  }

  // ✨ 'any' 대신 명확한 타입을 사용합니다.
  const finalResult: AnalysisResultPayload = {
    analysisType: "dependency",
    target: params.targetFunction,
    findings: [],
  };

  for (const file of filesToAnalyze) {
    // ✨ 'any' 대신 명확한 타입을 사용합니다.
    let findings: DependencyAnalysisResult | null = null;
    switch (params.analysisMode) {
      case "dependency":
        if (params.targetFunction) {
          findings = runDependencyAnalysis(file.content, params.targetFunction);
        }
        break;
    }
    if (findings && findings.target) {
      finalResult.findings.push({ file: file.name, results: findings });
    }
  }

  // 분석된 내용이 없으면 null을 반환할 수 있습니다.
  if (finalResult.findings.length === 0) {
    return null;
  }

  return finalResult;
};

/**
 * 분석 결과 원본 데이터를 UI에 표시할 리포트와 그래프 데이터로 가공합니다.
 * @param result 분석 결과 원본 객체
 * @returns UI에 필요한 데이터 (리포트, 그래프)
 */
export const processAnalysisResult = (
  result: AnalysisResultPayload
): ProcessedResult => {
  // ✨ useAnalysis 훅에서 이미 null 체크를 하므로, 여기서는 null 체크를 제거해도 안전합니다.

  let fullReport = `# 📝 분석 결과\n\n`;
  let graphData: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

  // ✨ 'any' 대신 명확한 타입을 사용합니다.
  result.findings.forEach((findingGroup: FileFinding<DependencyFinding>) => {
    fullReport += `## 📄 소스: ${findingGroup.file}\n`;

    switch (result.analysisType) {
      case "dependency":
        const { target, dependencies } = findingGroup.results;
        graphData = createDependencyGraphData(result.target, dependencies);

        // ✨ target이 null일 수 있는 가능성을 타입이 알려주므로, 안전하게 체크합니다.
        if (target) {
          fullReport += `### 🎯 타겟 함수: \`${result.target}\`\n\`\`\`javascript\n${target}\n\`\`\`\n`;
        }

        if (dependencies.length > 0) {
          fullReport += `\n#### 📞 호출하는 함수 목록\n`;
          // ✨ 'any' 대신 명확한 타입을 사용합니다.
          dependencies.forEach((dep: DependencyInfo) => {
            fullReport += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
          });
        }
        break;
    }
  });

  return { report: fullReport, graphData };
};
