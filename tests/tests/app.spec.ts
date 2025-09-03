import { test, expect, _electron as electron, ElectronApplication, Page } from "playwright/test";
import path from "path"; // ✨ Node.js의 path 모듈을 가져옵니다.

let electronApp: ElectronApplication;
let window: Page;

// 모든 테스트가 시작되기 전에 딱 한 번 실행됩니다.
test.beforeAll(async () => {
    // ✨ [핵심 수정] process.cwd()를 기준으로 main.js의 절대 경로를 계산합니다.
    // process.cwd()는 'npm run test:e2e'를 실행한 프로젝트 루트 경로를 반환합니다.
    const mainProcessPath = path.join(process.cwd(), 'build', 'electron', 'electron', 'main.js');

    // ✨ 계산된 절대 경로를 사용하여 Electron 앱을 실행합니다.
    electronApp = await electron.launch({ args: [mainProcessPath] });

    window = await electronApp.firstWindow();
});

// 모든 테스트가 끝난 후에 딱 한 번 실행됩니다.
test.afterAll(async () => {
    if (electronApp) {
        await electronApp.close();
    }
});

test("의존성 분석이 성공적으로 실행되고 결과가 화면에 표시되어야 한다", async () => {
    // 1. Arrange (준비)
    const testCode = `
    function main() { sub(); }
    function sub() { console.log('hello'); }
  `;
    const targetFunction = "main";

    // 2. Act (실행)
    await window.locator('textarea[placeholder*="분석할 코드를 붙여넣으세요"]').fill(testCode);
    await window.locator('input[placeholder="예: handlePayment"]').fill(targetFunction);
    await window.locator('button', { hasText: '분석 실행' }).click();

    // 3. Assert (검증)
    const resultSection = window.locator('.output-section');
    await expect(resultSection).toContainText("sub");
});
