import JSZip from "jszip";
import { type Edge, type Node } from "reactflow";
import { runDependencyAnalysis } from "../core/analysis";
import type { AnalysisParams, AnalysisResultPayload, DependencyInfo } from "../types";
import { createDependencyGraphData } from "./graphService";

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
 */
export const runWebAnalysis = async (
  params: AnalysisParams
): Promise<AnalysisResultPayload | null> => {
  if (params.sourceMethod === "folder") {
    throw new Error("폴더 분석은 데스크톱 앱에서만 지원됩니다.");
  }

  const filesToAnalyze: { name: string; content: string; path: string }[] = [];

  if (params.sourceMethod === "paste") {
    if (!params.pastedCode) throw new Error("분석할 소스 코드를 입력해야 합니다.");
    filesToAnalyze.push({ name: "Pasted Code", content: params.pastedCode, path: "pasted.ts" });
  } else if (params.sourceMethod === "upload" && params.selectedFileObject) {
    if (params.selectedFileObject.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(params.selectedFileObject);
      for (const zipEntry of Object.values(zip.files)) {
        if (!zipEntry.dir) {
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

  if (params.analysisMode === "dependency") {
    const analysisResult = runDependencyAnalysis(
      filesToAnalyze,
      params.targetFunction
    );

    if (!analysisResult || !analysisResult.target) {
      return null;
    }

    const payload: AnalysisResultPayload = {
      analysisType: "dependency",
      target: analysisResult.target,
      findings: analysisResult.dependencies,
    };
    return payload;
  }
  return null;
};

/**
 * 분석 결과 원본 데이터를 UI에 표시할 리포트와 그래프 데이터로 가공합니다.
 */
export const processAnalysisResult = (
  result: AnalysisResultPayload,
  targetFunctionName: string
): ProcessedResult => {
  // --- 🕵️ 디버깅 콘솔 로그 ---
  console.log("[Service] processAnalysisResult 시작, 받은 데이터:", result);

  const { target, findings } = result;

  let fullReport = `# 📝 분석 결과\n\n`;

  if (target) {
    fullReport += `### 🎯 타겟 함수: \`${targetFunctionName}\`\n\`\`\`javascript\n${target}\n\`\`\`\n\n`;
  }

  // ✨ [핵심 수정] findings 배열을 파일 이름(file)으로 그룹화합니다.
  const groupedByFile = findings.reduce<Record<string, DependencyInfo[]>>((acc, find) => {
    const key = find.file || 'Unknown File';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(find);
    return acc;
  }, {});

  // --- 🕵️ 디버깅 콘솔 로그 ---
  console.log("[Service] 파일별로 그룹화된 결과:", groupedByFile);


  fullReport += `#### 📞 호출하는 함수 목록\n`;

  // ✨ 그룹화된 데이터를 기반으로 원래와 동일한 파일별 마크다운 소제목을 생성합니다.
  //    이것으로 ResultDisplay.tsx가 폴딩 기능을 다시 렌더링할 수 있습니다.
  for (const fileName in groupedByFile) {
    fullReport += `\n## 📄 소스: ${fileName}\n`;
    groupedByFile[fileName].forEach((dep: DependencyInfo) => {
      fullReport += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
    });
  }

  const graphData = createDependencyGraphData(targetFunctionName, findings);

  // --- 🕵️ 디버깅 콘솔 로그 ---
  console.log("[Service] 최종 생성된 리포트:", fullReport);
  console.log("[Service] 최종 생성된 그래프 데이터:", graphData);


  return { report: fullReport, graphData };
};

