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

test('히어로가 3D 를 못 그려도 글은 읽을 수 있다', async ({ page }) => {
  await page.goto('/')

  // 장식이 실패해도 제목과 설명은 남아야 한다.
  await expect(page.getByRole('heading', { name: '연구실적 분석 포털' })).toBeVisible()
  await expect(page.getByText(/대학알리미 전임교원 연구실적을/)).toBeVisible()
})

test('모션을 줄이겠다고 하면 3D 를 그리지 않는다', async ({ page }) => {
  // 사용자 의사가 성능보다 우선이다.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await expect(page.getByTestId('hero-static')).toBeAttached()
  await expect(page.getByTestId('hero-canvas')).toHaveCount(0)
  // 대체물은 장식이므로 보조 기술에서 감춘다
  await expect(page.getByTestId('hero-static')).toHaveAttribute('aria-hidden', 'true')
})

test('three.js 는 초기 로딩에 포함되지 않는다', async ({ page }) => {
  // 장식 때문에 분석 화면의 첫 로딩이 느려지면 본말이 전도된다.
  const chunks: string[] = []
  page.on('request', (r) => {
    const url = r.url()
    if (url.endsWith('.js')) chunks.push(url)
  })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('hero-static')).toBeAttached()

  const sceneChunk = chunks.filter((u) => u.includes('scene'))
  expect(sceneChunk, `3D 청크를 받았다: ${sceneChunk.join(', ')}`).toEqual([])
})
