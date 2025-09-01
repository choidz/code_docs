// ✨ 의존성 분석 결과의 가장 작은 단위 (함수 정보)
export interface DependencyInfo {
  name: string;
  content: string;
}

// ✨ 단일 파일에 대한 의존성 분석 결과
export interface DependencyFinding {
  target: string | null; // <- string 또는 null이 될 수 있도록
  dependencies: DependencyInfo[];
}

// ✨ 파일 정보를 포함하는 분석 결과 그룹 (제네릭 타입으로 다른 분석에도 활용 가능)
export interface FileFinding<T> {
  file: string;
  results: T;
}

// ✨ IPC를 통해 전달되는 최종 분석 결과물의 타입
export interface AnalysisResultPayload {
  analysisType: "dependency";
  target: string;
  findings: FileFinding<DependencyFinding>[];
}

// ✨ 분석 실행에 필요한 파라미터 타입 (useAnalysis에서 이동)
export interface AnalysisParams {
  analysisMode: "dependency" | "heatmap";
  targetFunction: string;
  sourceMethod: "paste" | "upload" | "folder";
  pastedCode: string;
  folderPath: string;
  filePath: string;
  selectedFileObject: File | null;
}

// ✨ 프리셋 타입은 그대로 유지
export interface AnalysisPreset {
  name: string;
  mode: "dependency";
  targetFunction: string;
}
