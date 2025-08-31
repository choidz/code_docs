// src/services/analysisService.ts

import JSZip from "jszip";
import { type Edge, type Node } from "reactflow";
import { runDependencyAnalysis } from "../core/analysis";
import { createDependencyGraphData } from "./graphService";

// UI가 사용할 최종 결과물의 타입 정의
interface ProcessedResult {
  report: string;
  graphData: {
    nodes: Node[];
    edges: Edge[];
  };
}

// 분석에 필요한 파라미터 타입 정의
interface AnalysisParams {
  analysisMode: "dependency" | "heatmap";
  targetFunction: string;
  sourceMethod: "paste" | "upload" | "folder";
  pastedCode: string;
  selectedFileObject: File | null;
}

/**
 * 웹 브라우저 환경에서 전체 분석 프로세스를 실행합니다.
 * @param params 분석에 필요한 모든 파라미터
 * @returns 분석 결과 데이터
 */
export const runWebAnalysis = async (params: AnalysisParams) => {
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

  const finalResult: any = {
    analysisType: params.analysisMode,
    target: params.targetFunction,
    findings: [],
  };

  for (const file of filesToAnalyze) {
    let findings: any = null;
    switch (params.analysisMode) {
      case "dependency":
        if (params.targetFunction) {
          const result = runDependencyAnalysis(
            file.content,
            params.targetFunction
          );
          if (result && result.target) findings = result;
        }
        break;
    }
    if (findings) {
      finalResult.findings.push({ file: file.name, ...findings });
    }
  }
  return finalResult;
};

/**
 * 분석 결과 원본 데이터를 UI에 표시할 리포트와 그래프 데이터로 가공합니다.
 * @param result 분석 결과 원본 객체
 * @returns UI에 필요한 데이터 (리포트, 그래프)
 */
export const processAnalysisResult = (result: any): ProcessedResult => {
  if (!result || !result.findings || result.findings.length === 0) {
    return {
      report: "분석 결과를 찾지 못했습니다.",
      graphData: { nodes: [], edges: [] },
    };
  }

  let fullReport = `# 📝 분석 결과\n\n`;
  let graphData: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

  result.findings.forEach((findingGroup: any) => {
    fullReport += `## 📄 소스: ${findingGroup.file}\n`;

    switch (result.analysisType) {
      case "dependency":
        const { target, dependencies } = findingGroup;
        graphData = createDependencyGraphData(result.target, dependencies);
        fullReport += `### 🎯 타겟 함수: \`${result.target}\`\n\`\`\`javascript\n${target}\n\`\`\`\n`;
        if (dependencies.length > 0) {
          fullReport += `\n#### 📞 호출하는 함수 목록\n`;
          dependencies.forEach((dep: any) => {
            fullReport += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
          });
        }
        break;
    }
  });

  return { report: fullReport, graphData };
};
