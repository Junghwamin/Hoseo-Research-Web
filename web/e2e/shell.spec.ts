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

  // 제품 이름은 상단바에, 히어로 표제는 h1 에 있다. 둘이 나뉜 이유는
  // 상단바가 스크롤해도 따라붙는 고정 지점이라서다.
  await expect(page.getByRole('banner')).toContainText('연구실적 분석 포털')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
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

test('히어로는 질문 하나와 자료 범위로 선다', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '우리 대학은 몇 번째인가' })).toBeVisible()
  await expect(page.getByText(/1인당 SCI급·SCOPUS 논문 수/)).toBeVisible()
  // 띠의 연도는 서버 응답에서 온다 — 상수가 아니다.
  await expect(page.getByRole('list', { name: '자료 범위' })).toContainText(/공시 \d{4}–\d{4}년/)
  // 사진·3D 가 없다. 다른 대학 캠퍼스 사진이 소속을 오해시킨 적이 있다.
  await expect(page.locator('section[aria-label="소개"] img, canvas')).toHaveCount(0)
})

test('히어로 장식은 보조 기술에서 감춘다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('hero-static')).toBeAttached()
  await expect(page.getByTestId('hero-static')).toHaveAttribute('aria-hidden', 'true')
})

test('휴대폰 첫 화면의 분석 시작이 1단계 입력으로 데려간다', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', '큰 화면에서는 1단계가 보이므로 버튼이 없다')
  await page.goto('/')
  await page.getByRole('button', { name: '분석 시작' }).click()
  await expect(page.getByTestId('university-input')).toBeFocused()
})
