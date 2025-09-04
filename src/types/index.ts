// ✨ 의존성 분석 결과의 가장 작은 단위 (함수 정보)
export interface DependencyInfo {
  name: string;
  content: string;
  file: string;
}

// ✨ 함수 의존성 분석 결과 타입
export interface AnalysisResultPayload {
  analysisType: "dependency";
  target: string | null;
  findings: DependencyInfo[];
}

// ✨ 모듈 그래프 분석 결과 타입
export interface ModuleGraphPayload {
  analysisType: 'module-graph';
  nodes: any[];
  edges: any[];
  report: string;
}

// ✨ [신규] React 특화 분석 결과 타입
export interface ReactAnalysisPayload {
  analysisType: 'react-analysis';
  tree: any[];
  godComponents: any[];
  report: string;
}

// ✨ 분석 실행에 필요한 파라미터 타입
export interface AnalysisParams {
  analysisMode: "dependency" | "heatmap" | "module" | "react-analysis";
  targetFunction: string;
  sourceMethod: "paste" | "upload" | "folder";
  pastedCode: string;
  folderPath: string;
  filePath: string;
  selectedFileObject: File | null;
}

// ✨ 프리셋 타입
export interface AnalysisPreset {
  name: string;
  mode: 'dependency' | 'module';
  targetFunction: string;
}

