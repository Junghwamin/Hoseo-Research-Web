import { defineConfig, devices } from '@playwright/test'

// 로컬 기본값은 venv, CI 는 PYTHON_BIN=python 을 넘긴다.
const PYTHON_BIN = process.env.PYTHON_BIN ?? '../.venv/Scripts/python.exe'

/**
 * 화면 단위 게이트(계획 §7.3).
 *
 * 개발 서버를 Playwright 가 직접 띄운다 — 사람이 미리 켜 두는 것을 잊으면
 * 테스트가 "환경 탓" 으로 실패해 신호가 흐려진다.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // 로컬에서 .only 를 남긴 채 커밋하면 CI 가 조용히 일부만 돌게 된다
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  // 프론트와 API 를 둘 다 띄운다. 사람이 미리 켜 두는 것을 잊으면
  // 테스트가 '환경 탓' 으로 실패해 신호가 흐려진다.
  webServer: [
    {
      // 로컬은 venv, CI 는 시스템 python 을 쓴다. 경로를 박아두면 한쪽이 깨진다.
      command: `${PYTHON_BIN} -m uvicorn api.main:app --host 127.0.0.1 --port 8000`,
      cwd: '..',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
