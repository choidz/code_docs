// 이 파일은 프로젝트 전체에서 사용될 타입 정의들을 모아두는 곳입니다.

/** JSON 기반 분석기의 설정 타입 */
export interface AnalysisConfig {
  targetFiles: string[];
  searchKeywords: string[];
}

/** AST 분석 결과로 나온 개별 함수의 타입 */
export interface AstFunction {
  code: string;
  explanation: string;
  isLoading: boolean;
}

export interface AnalysisPreset {
  name: string;
  mode: "keyword" | "dependency";
  keywords: string;
  targetFunction: string;
  shouldExtractBlocks: boolean;
}
