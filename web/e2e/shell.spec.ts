import { test, expect } from '@playwright/test'

/**
 * 화면 게이트(계획 §7.3).
 *
 * Phase 4 부터는 **실제 API** 를 물고 돈다. 하드코딩 더미로는 계약이 맞는지
 * 알 수 없어서다. 여기서 잠그는 수치는 원본 Streamlit 판과 대조해 확인한 값이다.
 */

test('앱이 예외 없이 뜨고 제목을 보여준다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')

  await expect(page.getByRole('heading', { name: '연구실적 분석 포털' })).toBeVisible()
  await expect(page.getByTestId('api-error')).toHaveCount(0)
  expect(errors, `콘솔 예외: ${errors.join(' / ')}`).toEqual([])
})

test('미구현 모듈은 DOM 에 아예 없다', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('module-research')).toBeVisible()

  // 흐리게 보이는 것도 아니고, 존재 자체가 없어야 한다.
  // Streamlit 판에서는 "Coming Soon" 버튼과 "준비 중" 뱃지가 떠 있었다.
  await expect(page.getByTestId('module-educationCost')).toHaveCount(0)
  await expect(page.getByTestId('module-employment')).toHaveCount(0)
  await expect(page.getByText('준비 중')).toHaveCount(0)
  await expect(page.getByText('Coming Soon')).toHaveCount(0)
})

test('테마를 바꾸면 data-theme 이 바뀌고 새로고침 후에도 유지된다', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '다크' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // 시스템으로 되돌리면 속성이 사라진다(= OS 설정에 위임)
  await page.getByRole('button', { name: '시스템' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('API 에서 받은 실제 수치를 그린다', async ({ page }) => {
  await page.goto('/')

  // 2026년 호서대: 전국 71위 / 권역 17위 / 1인당 0.1297편 / 교원 406명
  // 원본 Streamlit 판과 대조해 확인한 값이다.
  await expect(page.getByText('71위')).toBeVisible()
  await expect(page.getByText('17위')).toBeVisible()
  await expect(page.getByText('0.1297편')).toBeVisible()
  await expect(page.getByText('406명')).toBeVisible()

  await expect(page.getByText('호서대학교 · 충청권 · 2026년')).toBeVisible()
})

test('순위 개선을 상승으로 표시한다 (V09 회귀 잠금)', async ({ page }) => {
  await page.goto('/')

  // 2025년 77위 → 2026년 71위 = 6계단 개선.
  // Streamlit 판은 이걸 빨간 하락 화살표로 표시했다.
  const nationalDelta = page.getByTestId('metric-delta').first()
  await expect(nationalDelta).toHaveAttribute('data-direction', 'up')
  await expect(nationalDelta).toContainText('▲')
  await expect(nationalDelta).toContainText('+6계단')
})

test('전국순위 모집단을 화면에 밝힌다 (V14)', async ({ page }) => {
  await page.goto('/')
  // 사용자 결정은 "현행 유지 + 라벨 명시" 였다. 라벨이 실제로 떠야 한다.
  await expect(page.getByText(/등재된 사립 \d+개교 기준/)).toBeVisible()
})

test('추이 차트가 접근 가능한 표를 함께 제공한다', async ({ page }) => {
  await page.goto('/')

  const chart = page.getByRole('img', { name: /1인당 논문 수 추이/ })
  await expect(chart).toBeVisible()

  // SVG 는 스크린리더가 못 읽는다. 같은 수치가 표에도 있어야 한다.
  const table = page.getByRole('table')
  await expect(table).toContainText('2026년')
  await expect(table).toContainText('0.1297')
})
