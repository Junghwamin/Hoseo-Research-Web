import { test, expect } from '@playwright/test'

/**
 * Phase 1 게이트: 검증 루프가 실제로 도는지 확인한다.
 *
 * 여기서 잠그는 계약 하나는 Phase 5 이후에도 유효하다 —
 * **꺼진 기능은 DOM 에 존재하지 않는다**(계획 §6·§12-4).
 */

test('앱이 예외 없이 뜨고 제목을 보여준다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')

  await expect(page.getByRole('heading', { name: '연구실적 분석 포털' })).toBeVisible()
  expect(errors, `콘솔 예외: ${errors.join(' / ')}`).toEqual([])
})

test('미구현 모듈은 DOM 에 아예 없다', async ({ page }) => {
  await page.goto('/')

  // 구현된 것만 보인다
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

test('증감 배지가 방향을 올바르게 표시한다 (V09 회귀 잠금)', async ({ page }) => {
  await page.goto('/')

  // 전국순위 71위 / +6계단 = 개선
  const card = page.locator('[data-testid="metric-delta"]').first()
  await expect(card).toHaveAttribute('data-direction', 'up')
  await expect(card).toContainText('▲')
  await expect(card).toContainText('+6계단')
})

test('값 없음과 0 을 구분해 표시한다', async ({ page }) => {
  await page.goto('/')
  // 권역순위는 데이터 없음 → '—'
  await expect(page.getByText('—')).toBeVisible()
})
