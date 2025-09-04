import { create } from 'zustand';
import { type Node, type Edge } from 'reactflow';
import { processAnalysisResult } from '../services/analysisService';
// ✨ 수정된 타입 정의를 가져옵니다.
import type { AnalysisResultPayload, ModuleGraphPayload } from '../types';

interface GraphData {
    nodes: Node[];
    edges: Edge[];
}

// 스토어가 관리할 상태의 타입 정의
interface AnalysisState {
    isLoading: boolean;
    statusMessage: string;
    extractionResult: string;
    graphData: GraphData;
    moduleGraphData: GraphData;
    actions: {
        startAnalysis: () => void;
        setSuccess: (report: string, graphData: GraphData) => void;
        setError: (errorMessage: string) => void;
        // ✨ [수정] 핸들러가 타겟 함수 이름도 받도록 시그니처를 변경합니다.
        handleAnalysisResult: (
            result: AnalysisResultPayload | ModuleGraphPayload | { error: string } | null,
            targetFunction: string
        ) => void;
    };
}

// Zustand 스토어 생성
export const useAnalysisStore = create<AnalysisState>((set, get) => ({
    // 1. 초기 상태
    isLoading: false,
    statusMessage: '',
    extractionResult: '',
    graphData: { nodes: [], edges: [] },
    moduleGraphData: { nodes: [], edges: [] },

    // 2. 상태를 변경하는 함수 (Actions)
    actions: {
        startAnalysis: () => set({
            isLoading: true,
            extractionResult: '',
            statusMessage: '',
            graphData: { nodes: [], edges: [] },
            moduleGraphData: { nodes: [], edges: [] },
        }),

        setSuccess: (report, graphData) => set({
            isLoading: false,
            extractionResult: report,
            graphData,
        }),

        setError: (errorMessage) => set({
            isLoading: false,
            extractionResult: `# ❗ 분석 중 오류가 발생했습니다.\n\n${errorMessage}`,
            graphData: { nodes: [], edges: [] },
            moduleGraphData: { nodes: [], edges: [] },
        }),

        // ✨ [수정] 백엔드 결과 유형에 따라 분기 처리하는 핵심 로직
        handleAnalysisResult: (result, targetFunction) => {
            if (!result) {
                get().actions.setError('분석 결과를 받지 못했습니다.');
                return;
            }

            if ('error' in result) {
                get().actions.setError(result.error || '알 수 없는 오류');
                return;
            }

            switch (result.analysisType) {
                case 'module-graph':
                    set({
                        isLoading: false,
                        moduleGraphData: { nodes: result.nodes, edges: result.edges },
                        extractionResult: `✅ 총 ${result.nodes.length}개의 모듈 간의 의존성 분석이 완료되었습니다.`
                    });
                    break;

                case 'dependency':
                    // target이 null이거나 findings가 없는 경우를 체크합니다.
                    if (!result.target || !result.findings) {
                        get().actions.setError('분석 결과를 찾지 못했습니다.');
                        return;
                    }
                    // ✨ [핵심 수정] processAnalysisResult 호출 시 targetFunction을 전달합니다.
                    const { report, graphData } = processAnalysisResult(result, targetFunction);
                    get().actions.setSuccess(report, graphData);
                    break;

                default:
                    // 'result' can be of type 'never' here if all cases are handled.
                    // This is a safe way to handle unexpected types.
                    get().actions.setError(`알 수 없는 분석 유형입니다.`);
                    break;
            }
        }
    }
}));

// 컴포넌트에서 액션을 더 쉽게 사용하기 위한 편의 훅
export const useAnalysisActions = () => useAnalysisStore((state) => state.actions);

