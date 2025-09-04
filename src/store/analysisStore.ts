import { create } from 'zustand';
import { type Node, type Edge } from 'reactflow';
import { processAnalysisResult } from '../services/analysisService';
// ✨ 수정된 타입 정의를 모두 가져옵니다.
import type {
    AnalysisResultPayload,
    ModuleGraphPayload,
    ReactAnalysisPayload,
} from '../types';

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
        // ✨ [수정] 핸들러가 ReactAnalysisPayload 타입도 받을 수 있도록 시그니처를 업데이트합니다.
        handleAnalysisResult: (
            result: AnalysisResultPayload | ModuleGraphPayload | ReactAnalysisPayload | { error: string } | null,
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
                        extractionResult: result.report, // report가 항상 존재하므로 그대로 사용
                    });
                    break;

                // ✨ [신규] React 분석 결과를 처리하는 로직 추가
                case 'react-analysis':
                    set({
                        isLoading: false,
                        graphData: { nodes: [], edges: [] },
                        moduleGraphData: { nodes: [], edges: [] },
                        extractionResult: result.report,
                    });
                    break;

                case 'dependency':
                    if (!result.target || !result.findings) {
                        get().actions.setError('분석 결과를 찾지 못했습니다.');
                        return;
                    }
                    const { report, graphData } = processAnalysisResult(result, targetFunction);
                    get().actions.setSuccess(report, graphData);
                    break;

                default:
                    get().actions.setError(`알 수 없는 분석 유형입니다.`);
                    break;
            }
        }
    }
}));

// 컴포넌트에서 액션을 더 쉽게 사용하기 위한 편의 훅
export const useAnalysisActions = () => useAnalysisStore((state) => state.actions);

