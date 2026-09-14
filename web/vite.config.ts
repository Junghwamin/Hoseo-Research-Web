import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// FastAPI 가 web/dist 를 정적 서빙한다(§11). 개발 중에는 /api 호출만
// 백엔드로 프록시해서 CORS 설정 없이 같은 출처처럼 쓴다.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Windows 에서 localhost 는 ::1(IPv6) 로 풀린다. Playwright 가 기다리는
    // 127.0.0.1 과 어긋나 webServer 타임아웃이 났다. 명시적으로 고정한다.
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    // 설치본은 오프라인이다. 소스맵은 빌드 산출물 크기만 키우므로 끈다.
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Playwright 의 E2E 는 vitest 가 수집하지 않는다
    exclude: ['node_modules', 'dist', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
