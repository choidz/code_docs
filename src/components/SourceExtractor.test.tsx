// src/components/SourceExtractor.test.tsx

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SourceExtractor from "./SourceExtractor";
import { useAnalysisStore } from "../store/analysisStore";
import { vi } from "vitest"; // ✨ Vitest의 mock 기능을 가져옵니다.

// ✨ 테스트를 실행하기 전에 analysisService 모듈을 통째로 가짜(mock)로 만듭니다.
vi.mock("../services/analysisService", () => ({
    // runWebAnalysis를 가짜 async 함수로 대체합니다.
    // 이 함수는 호출되면 빈 Promise를 반환하여 비동기인 척만 합니다.
    runWebAnalysis: vi.fn(() => new Promise(() => { })),
    // processAnalysisResult도 실제 로직이 필요 없으므로 가짜 함수로 만듭니다.
    processAnalysisResult: vi.fn(),
}));

const initialStoreState = useAnalysisStore.getState();

describe("<SourceExtractor /> 통합 테스트", () => {
    beforeEach(() => {
        useAnalysisStore.setState(initialStoreState);
        // 각 테스트 전에 mock 함수의 호출 기록을 초기화합니다.
        vi.clearAllMocks();
    });

    it("'분석 실행' 버튼을 클릭하면 isLoading 상태가 true로 변경되어야 한다", async () => {
        render(<SourceExtractor />);

        expect(useAnalysisStore.getState().isLoading).toBe(false);

        const analysisButton = screen.getByRole("button", { name: /분석 실행/i });
        await userEvent.click(analysisButton);

        // ✨ 이제 runAnalysis 내부의 startAnalysis()가 동기적으로 실행되므로,
        //    waitFor를 사용하지 않아도 상태를 바로 확인할 수 있습니다.
        expect(useAnalysisStore.getState().isLoading).toBe(true);
    });
});