/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        // ✨ 1. 테스트할 파일을 src 폴더로 한정합니다. (불필요한 build 폴더 스캔 방지)
        include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
        // ✨ 2. E2E 테스트 폴더는 Vitest의 스캔 대상에서 제외합니다.
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests'],
    },
});