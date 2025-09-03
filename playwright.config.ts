import { defineConfig } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    // ✨ "테스트 파일은 이 설정 파일이 있는 위치를 기준으로 ./tests 폴더 안에서 찾아라" 라고 명시합니다.
    testDir: './tests',

    // 테스트 타임아웃을 30초로 설정합니다.
    timeout: 30 * 1000,

    expect: {
        // expect()의 타임아웃을 5초로 설정합니다.
        timeout: 5000
    },

    // 모든 테스트를 병렬로 실행합니다.
    fullyParallel: true,

    // CI 환경에서 실수로 test.only가 코드에 남아있으면 빌드를 실패시킵니다.
    forbidOnly: !!process.env.CI,

    // CI 환경에서만 재시도합니다.
    retries: process.env.CI ? 2 : 0,

    // CI 환경이 아니면 사용할 수 있는 모든 CPU 코어를 사용해 병렬로 테스트합니다.
    workers: process.env.CI ? 1 : undefined,

    // 터미널에 표시될 리포터 형식입니다.
    reporter: 'list',

    use: {
        // 실패한 테스트를 재시도할 때 스크린샷과 동작 기록(trace)을 수집합니다.
        trace: 'on-first-retry',
    },
});