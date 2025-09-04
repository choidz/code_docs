// ✨ 의존성 분석 결과의 가장 작은 단위 (함수 정보)
export interface DependencyInfo {
  name: string;
  content: string;
  file: string; // ✨ 소스 파일명을 저장하기 위한 속성 추가
}

// ✨ 단일 파일에 대한 의존성 분석 결과
export interface DependencyFinding {
  target: string | null;
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
  target: string | null;
  // ✨ findings 타입이 파일 정보를 포함하는 DependencyInfo 배열이 되도록 업데이트
  findings: DependencyInfo[];
}

// ✨ 모듈 그래프 분석 결과 타입
export interface ModuleGraphPayload {
  analysisType: 'module-graph';
  nodes: any[]; // React Flow 노드 타입
  edges: any[]; // React Flow 엣지 타입
}


// ✨ 분석 실행에 필요한 파라미터 타입 (useAnalysis에서 이동)
export interface AnalysisParams {
  analysisMode: "dependency" | "heatmap" | "module";
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
  mode: 'dependency' | 'module';
  targetFunction: string;
}

