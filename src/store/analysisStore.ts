
import { create } from 'zustand';
import { type Node, type Edge } from 'reactflow';
import { processAnalysisResult } from '../services/analysisService';
import type { AnalysisResultPayload } from '../types';

// 스토어가 관리할 상태의 타입 정의
interface AnalysisState {
    isLoading: boolean;
    statusMessage: string;
    extractionResult: string;
    graphData: {
        nodes: Node[];
        edges: Edge[];
    };
    actions: {
        startAnalysis: () => void;
        setSuccess: (report: string, graphData: { nodes: Node[]; edges: Edge[] }) => void;
        setError: (errorMessage: string) => void;
        handleAnalysisResult: (result: AnalysisResultPayload | { error: string } | null) => void;
    };
}

// Zustand 스토어 생성
export const useAnalysisStore = create<AnalysisState>((set, get) => ({
    // 1. 초기 상태
    isLoading: false,
    statusMessage: '',
    extractionResult: '',
    graphData: { nodes: [], edges: [] },

    // 2. 상태를 변경하는 함수 (Actions)
    actions: {
        // 분석 시작 시 상태 초기화
        startAnalysis: () => set({
            isLoading: true,
            extractionResult: '',
            statusMessage: '',
            graphData: { nodes: [], edges: [] }
        }),

        // 성공 시 결과 업데이트
        setSuccess: (report, graphData) => set({
            isLoading: false,
            extractionResult: report,
            graphData,
        }),

        // 에러 발생 시 상태 업데이트
        setError: (errorMessage) => set({
            isLoading: false,
            extractionResult: `# ❗ 분석 중 오류가 발생했습니다.\n\n${errorMessage}`,
            graphData: { nodes: [], edges: [] },
        }),

        // useAnalysis 훅에 있던 결과 처리 로직을 이곳으로 이동
        handleAnalysisResult: (result: AnalysisResultPayload | { error: string } | null) => {
            // 1단계: result가 null인 경우 처리
            if (!result) {
                get().actions.setError('분석 결과를 찾지 못했습니다.');
                return;
            }

            // 2단계: 에러 객체인 경우 처리
            if ('error' in result) {
                get().actions.setError(result.error || '알 수 없는 오류');
                return;
            }

            // 3단계: 이제 result는 AnalysisResultPayload 타입임이 확실합니다.
            //         findings 배열이 비어있는 경우를 처리합니다.
            if (result.findings.length === 0) {
                get().actions.setError('분석 결과를 찾지 못했습니다.');
                return;
            }

            // 4단계: 모든 검사를 통과한, 내용물이 있는 성공적인 결과만 처리합니다.
            const { report, graphData } = processAnalysisResult(result);
            get().actions.setSuccess(report, graphData);
        }
    }
}));

// ✨ 컴포넌트에서 액션을 더 쉽게 사용하기 위한 편의 훅
export const useAnalysisActions = () => useAnalysisStore((state) => state.actions);