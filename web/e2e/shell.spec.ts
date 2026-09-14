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
  //
  // 비교군 표에도 같은 문자열이 나오므로 지표 섹션으로 범위를 좁힌다.
  // (Playwright 는 다중 일치를 실패로 본다 — 좁히는 것이 맞다.)
  const metrics = page.getByRole('region', { name: '주요 지표' })
  await expect(metrics.getByText('71위')).toBeVisible()
  await expect(metrics.getByText('17위')).toBeVisible()
  await expect(metrics.getByText('0.1297편')).toBeVisible()
  await expect(metrics.getByText('406명')).toBeVisible()

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
  // 화면에 표가 둘(추이 접근성 표 + 비교군 표)이라 이름으로 좁힌다.
  const table = page.getByRole('table', { name: /추이/ })
  await expect(table).toContainText('2026년')
  await expect(table).toContainText('0.1297')
})

test('비교군 표를 실제 수치로 그린다', async ({ page }) => {
  await page.goto('/')

  const table = page.getByRole('table', { name: /비교군/ })
  await expect(table).toBeVisible()

  // 2026년 충청권 비교군 5개교. 원본 Streamlit 코어와 대조한 값이다.
  await expect(table).toContainText('931명')      // 순천향대 전임교원수
  await expect(table).toContainText('368.8편')    // 순천향대 논문수(소수 1자리)
  await expect(table).toContainText('0.3961')     // 순천향대 1인당(소수 4자리)
  await expect(table).toContainText('26위')       // 순천향대 전국순위

  // 실적이 0 에 가까운 대학도 값 없음(—)이 아니라 숫자로 찍힌다
  await expect(table).toContainText('0.0270')
})

test('증감 패널이 과거 → 현재 순서로 적는다 (R-RS-03)', async ({ page }) => {
  await page.goto('/')

  const target = page.getByTestId('yoy-target')
  await expect(target).toBeVisible()
  await expect(target).toContainText('+9.7%')

  // 원본 Streamlit 판은 "2026 → 2025" 로 시간이 거꾸로 흐르는 문구를 찍었다.
  await expect(target).toContainText('2025년 0.1182 → 2026년 0.1297')
})

test('증감 상·하위가 각각 이름 붙은 영역으로 그려진다', async ({ page }) => {
  await page.goto('/')

  const top = page.getByRole('group', { name: /증가 상위/ })
  const bottom = page.getByRole('group', { name: /감소 하위/ })

  await expect(top).toContainText('+196.7%')
  await expect(bottom).toContainText('-50.5%')

  // 부호가 보존되어야 한다. 절대값만 찍으면 감소가 증가처럼 보인다.
  await expect(bottom).toContainText('▼')
  await expect(top).toContainText('▲')
})

test('증감률 null 이 "+0.0%" 로 새어나오지 않는다 (V12)', async ({ page }) => {
  await page.goto('/')

  // 충청권 2026 에는 null 이 없지만, 화면 어디에도 "+0.0%" 가 없어야 한다는
  // 계약 자체를 잠근다. null 을 0 으로 접는 회귀가 생기면 여기서 먼저 걸린다.
  const panel = page.getByRole('region', { name: '전년 대비 증감' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('+0.0%')).toHaveCount(0)
})
