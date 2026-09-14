import { test, expect, type Page } from '@playwright/test'

/**
 * 5단계 마법사 관통 E2E.
 *
 * 여기서 잠그는 시나리오는 전부 원본 Streamlit 판에서 **실제로 났던 결함**이다.
 * 리듀서 단위 테스트가 이미 같은 계약을 잠그고 있지만, 단위 테스트는
 * "렌더까지 포함해 정말 그런가" 를 말해주지 못한다.
 */

/** 1단계에서 데이터를 불러오고 2단계까지 간다. */
async function loadAndAdvance(page: Page) {
  await page.goto('/')
  await page.getByTestId('load-button').click()
  await expect(page.getByTestId('load-summary')).toContainText('호서대학교')
  await page.getByTestId('next-button').click()
}

test('1단계에서 데이터를 불러오면 서버가 권역을 확정해 돌려준다 (V03)', async ({ page }) => {
  await page.goto('/')

  // 권역을 입력하지 않았는데도 서버가 충청권으로 확정해야 한다.
  // Streamlit 은 여기서 None 을 흘려보내 '권역평균' 이 전국 평균이 됐다.
  await page.getByTestId('load-button').click()
  await expect(page.getByTestId('load-summary')).toContainText('충청권')
  await expect(page.getByTestId('load-summary')).toContainText('2026년')
})

test('불러오기 전에는 다음으로 갈 수 없다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('next-button')).toBeDisabled()
  await expect(page.getByTestId('step-2')).toBeDisabled()
})

test('진행하면 단계가 열리고, 뒤로 가도 닫히지 않는다 (V19)', async ({ page }) => {
  await loadAndAdvance(page) // 2단계
  await page.getByTestId('next-button').click() // 3단계
  await expect(page.getByTestId('step-3')).toHaveAttribute('aria-current', 'step')

  // 1단계로 돌아가도 3단계는 열려 있어야 한다
  await page.getByTestId('step-1').click()
  await expect(page.getByTestId('step-3')).toBeEnabled()
  await expect(page.getByTestId('step-5')).toBeDisabled()
})

test('4단계 서술이 단계를 왕복해도 살아남는다 (V07)', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click() // 3
  await page.getByTestId('next-button').click() // 4

  await page.getByTestId('narrative-trend').fill('추이 서술 원문')
  await page.getByTestId('narrative-yoy').fill('증감 서술 원문')

  // 4 → 5 → 4. Streamlit 은 여기서 위젯 상태가 지워져 빈 문자열이 덮어썼다.
  await page.getByTestId('next-button').click()
  await page.getByTestId('step-4').click()
  await expect(page.getByTestId('narrative-trend')).toHaveValue('추이 서술 원문')

  // 4 → 1 → 4 도 마찬가지다
  await page.getByTestId('step-1').click()
  await page.getByTestId('step-4').click()
  await expect(page.getByTestId('narrative-trend')).toHaveValue('추이 서술 원문')
  await expect(page.getByTestId('narrative-yoy')).toHaveValue('증감 서술 원문')
})

test('사용자가 비운 서술을 되살리지 않는다 (V07 의 반대 방향)', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 4

  await page.getByTestId('narrative-trend').fill('일단 적는다')
  await page.getByTestId('narrative-trend').fill('')

  await page.getByTestId('step-1').click()
  await page.getByTestId('step-4').click()
  // "빈 값이면 백업하지 않는다" 는 단축을 쓰면 여기서 옛 값이 되살아난다
  await expect(page.getByTestId('narrative-trend')).toHaveValue('')
})

test('처음부터 다시 누르면 모든 것이 초기화된다 (V04 · V05 · V06)', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 4
  await page.getByTestId('narrative-trend').fill('지워져야 할 서술')

  await page.getByTestId('reset-button').click()

  // 1단계로 돌아간다
  await expect(page.getByTestId('step-1')).toHaveAttribute('aria-current', 'step')
  // 도달 범위도 되돌아간다 — Streamlit 은 max_step 을 안 건드려 잠긴 단계가 열려 있었다
  await expect(page.getByTestId('step-2')).toBeDisabled()
  await expect(page.getByTestId('step-4')).toBeDisabled()
  // 불러온 데이터가 사라진다
  await expect(page.getByTestId('load-summary')).toHaveCount(0)
  await expect(page.getByTestId('next-button')).toBeDisabled()
})

test('리셋 후 다시 불러와도 크래시하지 않는다 (V05)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await loadAndAdvance(page)
  await page.getByTestId('reset-button').click()
  await page.getByTestId('load-button').click()

  await expect(page.getByTestId('load-summary')).toContainText('호서대학교')
  await expect(page.getByTestId('api-error')).toHaveCount(0)
  expect(errors, `콘솔 예외: ${errors.join(' / ')}`).toEqual([])
})

test('리셋 후 서술이 남지 않는다 (V06 × V07 연쇄)', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 4
  await page.getByTestId('narrative-trend').fill('이전 분석의 서술')

  await page.getByTestId('reset-button').click()
  await page.getByTestId('load-button').click()
  await page.getByTestId('next-button').click() // 2
  await page.getByTestId('next-button').click() // 3
  await page.getByTestId('next-button').click() // 4

  // Streamlit 은 리셋 후 사이드바로 5단계에 직행하면 이전 _saved_ 서술이
  // 새 보고서에 그대로 들어갔다.
  await expect(page.getByTestId('narrative-trend')).toHaveValue('')
})

test('대상을 바꾸면 이전 분석 결과가 남지 않는다 (V17)', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 4
  await page.getByTestId('narrative-trend').fill('호서대 서술')

  await page.getByTestId('step-1').click()
  await page.getByTestId('university-input').fill('순천향대학교')
  await page.getByTestId('load-button').click()

  await expect(page.getByTestId('load-summary')).toContainText('순천향대학교')
  // 도달 범위가 1 로 좁아져 옛 파생 상태를 그리려다 터지는 일이 없다
  await expect(page.getByTestId('step-4')).toBeDisabled()

  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 4
  await expect(page.getByTestId('narrative-trend')).toHaveValue('')
})

test('없는 대학을 부르면 이유를 알려주고 옛 데이터를 남기지 않는다', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('step-1').click()

  await page.getByTestId('university-input').fill('없는대학교')
  await page.getByTestId('load-button').click()

  await expect(page.getByTestId('api-error')).toContainText('없는 대학')
  // 실패했는데 옛 숫자가 남아 있으면 성공한 것처럼 보인다
  await expect(page.getByTestId('load-summary')).toHaveCount(0)
})

test('3단계에서 차트·비교표·증감이 모두 실수치로 그려진다', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click() // 3

  await expect(page.getByRole('table', { name: /비교군/ })).toContainText('931명')
  await expect(page.getByTestId('yoy-target')).toContainText('2025년 0.1182 → 2026년 0.1297')
  await expect(page.getByRole('img', { name: /추이/ })).toBeVisible()
})

test('5단계가 서술 유무를 요약한다', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 4
  await page.getByTestId('narrative-trend').fill('열두 글자짜리 서술')
  await page.getByTestId('next-button').click() // 5

  const summary = page.getByTestId('report-summary')
  await expect(summary).toContainText('연도별 추이')
  await expect(summary).toContainText('자')
  await expect(summary).toContainText('비어 있음') // 나머지 3개
})

test('5단계에서 Word 보고서를 실제로 내려받는다', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 4
  await page.getByTestId('narrative-trend').fill('E2E 가 넣은 추이 서술')
  await page.getByTestId('next-button').click() // 5

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-button').click(),
  ]).then(([d]) => d)

  // 파일명은 서버가 RFC 5987 로 보낸 것을 그대로 쓴다
  expect(download.suggestedFilename()).toContain('호서대학교')
  expect(download.suggestedFilename()).toContain('2026')
  expect(download.suggestedFilename()).toMatch(/\.docx$/)

  const path = await download.path()
  expect(path, '다운로드 파일이 없다').toBeTruthy()
})

test('GPT 키가 없으면 이유를 말한다 (V16)', async ({ page }) => {
  // 서버에 키가 없는 상태로 CI/로컬이 돈다. 사이드바에 "⚠ 미설정" 만 뜨고
  // 원인을 안 알려주던 것이 V16 이었다.
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 4

  await page.getByTestId('generate-button').click()

  const err = page.getByTestId('api-error')
  await expect(err).toBeVisible()
  await expect(err).toContainText('OPENAI_API_KEY')
  // 문서가 안내하던 중첩 테이블 형식이 원인이었으므로 그것도 짚어준다
  await expect(err).toContainText('평면 키')
})

test('서술이 비어도 보고서가 나온다', async ({ page }) => {
  await loadAndAdvance(page)
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click()
  await page.getByTestId('next-button').click() // 5

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-button').click(),
  ]).then(([d]) => d)

  expect(await download.path()).toBeTruthy()
})
