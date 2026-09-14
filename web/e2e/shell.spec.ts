import { test, expect } from '@playwright/test'

/**
 * 앱 셸 게이트.
 *
 * 5단계 흐름은 `wizard.spec.ts` 가 맡는다. 여기는 셸(제목·모듈 목록·테마)만 본다.
 */

test('앱이 예외 없이 뜬다', async ({ page }) => {
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

test('전국순위 모집단을 화면에 밝힌다 (V14)', async ({ page }) => {
  await page.goto('/')
  // 사용자 결정은 "현행 유지 + 라벨 명시" 였다. 라벨이 실제로 떠야 한다.
  await expect(page.getByText(/등재된 사립 \d+개교 기준/)).toBeVisible()
})
