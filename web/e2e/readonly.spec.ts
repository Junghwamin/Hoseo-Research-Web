import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { test, expect, type Locator, type Page } from '@playwright/test'

/**
 * 공개 사이트 모드 관통 E2E.
 *
 * Vercel 에서는 디스크가 읽기 전용이고 서버에 OpenAI 키를 두지 않는다. 그 상태를
 * 개발 PC 에서 재현하는 스위치가 `HOSEO_FORCE_READONLY=1` 이다 — 서버는
 * `canPersist=false` 를 돌려주고, `.env` 에 진짜 키가 있어도 없는 것으로 친다.
 * 그래서 이 파일은 **그 스위치로 띄운 서버에서만** 성립하고, 아니면 통째로 건너뛴다.
 *
 *   $env:API_PORT='8011'; $env:HOSEO_FORCE_READONLY='1'; npx playwright test readonly
 *
 * 여기서 잠그는 것은 산출물 A(브라우저 키)와 B(브라우저 데이터셋)의 관통 흐름이다.
 * 서버는 상태를 들지 않는다 — 키는 요청 헤더로, 추가 데이터는 요청 본문으로 오고
 * 요청이 끝나면 사라진다. 단위 테스트가 조각마다 잠그지만, "브라우저에 넣은 것이
 * 정말 서버 계산에 반영되는가" 는 렌더까지 포함해 돌려 봐야 안다.
 */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * 더할 해. 기본 데이터(2016–2026)에 없는 해여야 "더해졌다" 를 칩 하나로 확인할 수 있다.
 * 서버는 연도를 **파일명**에서 읽으므로(`core.preprocess.YEAR_PATTERN`), 실제 공시
 * xlsx 를 이 이름으로 올리면 그 해의 행이 2031년으로 계산된다. 권역 매핑은 연도와
 * 무관한 `config/regions.json` 이라 어느 해로 이름 붙여도 호서대학교는 충청권이다.
 */
const OVERLAY_YEAR = 2031
const OVERLAY_FILE_NAME = `${OVERLAY_YEAR}년_테스트.xlsx`

/**
 * 형식은 맞지만 진짜가 아닌 키. 화면 검사(`sk-`·길이·공백)와 서버 검사
 * (`^sk-[\x21-\x7e]{17,197}$`)를 통과해 OpenAI 까지 가서 인증에 실패한다.
 */
const FAKE_KEY = 'sk-' + 'e2e0'.repeat(10)

/** 서버의 `forced_readonly()` 와 같은 값만 참으로 본다 — `0` 을 켜진 것으로 읽지 않는다. */
const FORCED_READONLY = /^(1|true|yes)$/i.test((process.env.HOSEO_FORCE_READONLY ?? '').trim())

/** 저장소 루트의 `Raw data/`. 스펙 파일 기준이라 Playwright 의 cwd 와 무관하다. */
const RAW_DIR = fileURLToPath(new URL('../../Raw data/', import.meta.url))

interface RawFile {
  readonly path: string
  readonly year: number
}

/**
 * `Raw data/` 의 가장 최신 공시 xlsx. 연도는 파일명에서 읽는다 — 열한 파일의 mtime
 * 이 전부 같아서 stat 으로는 고를 수 없다. 폴더가 없거나 비어 있으면 null.
 */
function newestRawFile(): RawFile | null {
  let names: string[]
  try {
    names = readdirSync(RAW_DIR)
  } catch {
    return null
  }
  let best: RawFile | null = null
  for (const name of names) {
    const normalized = name.normalize('NFC')
    if (!normalized.toLowerCase().endsWith('.xlsx')) continue
    const match = /(\d{4})(?:년|_)/.exec(normalized)
    if (!match) continue
    const year = Number(match[1])
    if (best === null || year > best.year) best = { path: join(RAW_DIR, name), year }
  }
  return best
}

/** 콤보박스에서 대학을 고른다 — 타이핑으로 좁히고 목록에서 확정한다(wizard.spec 과 같다). */
async function pickUniversity(page: Page, name: string) {
  const input = page.getByTestId('university-input')
  await input.click()
  await input.fill(name)
  await page.getByRole('option', { name, exact: true }).click()
  await expect(input).toHaveValue(name)
}

/**
 * 모달을 닫고 닫혔는지 확인한다.
 *
 * 열린 동안 앱 본문은 `inert` 라서, 닫지 않고 마법사를 누르면 아무 일도 일어나지
 * 않은 채 타임아웃이 난다 — 그 실패는 제품 탓처럼 보이지만 테스트 탓이다.
 */
async function closeModal(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** 1단계 연도 칩. 기준 연도가 되면 이름이 `2031년 (기준 연도)` 로 길어지므로 앞만 본다. */
function yearChip(page: Page, year: number): Locator {
  return page.getByTestId('year-picker').getByRole('checkbox', { name: new RegExp(`^${year}년`) })
}

/**
 * 데이터 패널(브라우저 모드)에서 공시 xlsx 하나를 `OVERLAY_YEAR` 로 더한다.
 * 모달은 연 채로 돌려준다 — 목록·제거 버튼을 이어서 보는 테스트가 있다.
 *
 * 미리보기는 서버가 xlsx 한 해를 통째로 계산하는 일이라 수 초 걸린다. 워커 넷이
 * 동시에 올리면 더 걸리므로 기다리는 시간을 넉넉히 둔다.
 */
async function addOverlayYear(page: Page, raw: RawFile): Promise<Locator> {
  await page.getByTestId('data-update-toggle').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // 브라우저 모드다 — 「추가」 버튼이 있고 영구 갱신 버튼은 렌더 트리에 없다.
  // 모드는 서버의 canPersist 하나가 정한다. 둘 다 보이면 사용자는 어느 쪽이 서버를
  // 바꾸는지 알 수 없다. 패널은 지연 로드라 「추가」 버튼이 뜬 **뒤에** 없음을 봐야
  // 한다 — 먼저 보면 아직 비어 있는 Suspense 자리를 상대로 통과한다.
  await expect(dialog.getByTestId('overlay-add-button')).toBeVisible()
  await expect(dialog.getByTestId('preprocess-button')).toHaveCount(0)

  await dialog.getByTestId('raw-file-input').setInputFiles({
    name: OVERLAY_FILE_NAME,
    mimeType: XLSX_MIME,
    buffer: readFileSync(raw.path),
  })
  await dialog.getByTestId('overlay-add-button').click()
  await expect(dialog.getByTestId('overlay-result')).toContainText('추가됨', { timeout: 60_000 })
  return dialog
}

test.describe('공개 사이트 모드 (HOSEO_FORCE_READONLY=1)', () => {
  test.skip(!FORCED_READONLY, '읽기 전용 서버에서만 성립한다')
  // 업로드 미리보기와 OpenAI 왕복(인증 실패라도 네트워크를 탄다)이 들어 있다.
  // 기본 30초로는 느린 PC 에서 '진짜 실패' 와 구분되지 않는다.
  test.describe.configure({ timeout: 120_000 })

  test.beforeEach(async ({ page }) => {
    // 서버가 정말 그 모드인지 먼저 본다. `reuseExistingServer` 가 스위치 없이 떠 있던
    // 옛 서버를 잡으면 아래 실패가 전부 제품 탓처럼 보인다.
    const res = await page.request.get('/api/settings')
    const settings = (await res.json()) as { canPersist: boolean; apiKeyConfigured: boolean }
    expect(
      settings.canPersist,
      '서버가 읽기 전용 모드가 아니다. HOSEO_FORCE_READONLY=1 로 띄운 서버인지 확인한다 ' +
        '(API_PORT 를 바꿔 옛 서버 재사용을 피한다).',
    ).toBe(false)
    expect(
      settings.apiKeyConfigured,
      '읽기 전용 모드에서는 서버 키도 없는 것으로 쳐야 한다 — .env 의 키가 새고 있다.',
    ).toBe(false)
  })

  test('설정이 브라우저 키 폼을 보인다 — 서버에는 저장할 곳이 없다', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('settings-toggle').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByTestId('settings-status')).toHaveAttribute('data-mode', 'browser')
    // 키 값은 어떤 경우에도 화면에 오지 않는다 — 브라우저 키도 password 다.
    await expect(dialog.getByTestId('client-key-input')).toHaveAttribute('type', 'password')
    await expect(dialog.getByTestId('client-key-save')).toBeVisible()
    await expect(dialog.getByTestId('client-key-clear')).toBeVisible()
  })

  test('브라우저 키를 저장하면 4단계가 생성 가능 상태가 된다', async ({ page }) => {
    await page.goto('/')
    await pickUniversity(page, '호서대학교')
    await page.getByTestId('load-button').click()
    await expect(page.getByTestId('load-summary')).toContainText('호서대학교')
    await page.getByTestId('next-button').click() // 2
    await page.getByTestId('next-button').click() // 3
    await page.getByTestId('next-button').click() // 4

    // 키가 없으면 4단계가 그 자리에 브라우저 키 폼을 임베드한다 — V16 의 공개 사이트 판.
    // "꺼져 있습니다" 안내만 두고 할 일을 주지 않는 상태는 없다.
    const main = page.getByRole('main')
    await expect(main.getByTestId('client-key-input')).toBeVisible()

    // 저장은 상단바 설정에서 한다 — 사용자가 처음 만나는 길이다.
    await page.getByTestId('settings-toggle').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByTestId('settings-status')).toHaveAttribute('data-mode', 'browser')
    await dialog.getByTestId('client-key-input').fill(FAKE_KEY)
    await dialog.getByTestId('client-key-save').click()
    await closeModal(page)

    // 저장과 동시에 4단계가 다시 계산한다 — 임베드 폼이 걷히고 생성이 주 행동이 된다.
    await expect(main.getByTestId('client-key-input')).toHaveCount(0)
    const generate = page.getByTestId('generate-button')
    await expect(generate).toBeEnabled()
    await generate.click()

    // 요청은 헤더의 키로 OpenAI 까지 가서 인증에 실패한다. 화면에는 **그 실패**가
    // 보여야지, "키가 없다"(503) 가 보이면 헤더가 실리지 않은 것이다.
    // 절마다 따로 보내므로 전부 실패하면 narrative-error, 일부면 narrative-failed 다.
    const outcome = page
      .locator('[data-testid=narrative-error], [data-testid=narrative-failed]')
      .first()
    await expect(outcome).toBeVisible({ timeout: 90_000 })
    await expect(outcome).not.toContainText('OPENAI_API_KEY')
  })

  test('데이터 패널이 추가 모드이고 공시 xlsx 를 더하면 연도 칩과 자료 현황에 나타난다', async ({
    page,
  }) => {
    const raw = newestRawFile()
    test.skip(raw === null, 'Raw data/ 에 공시 xlsx 가 없다')

    await page.goto('/')
    // 전제: 기본 데이터에는 그 해가 없다. 칩이 그려진 뒤에 봐야 "아직 안 그려졌다" 와 갈린다.
    await expect(page.getByTestId('year-picker')).toBeVisible()
    await expect(yearChip(page, OVERLAY_YEAR)).toHaveCount(0)

    const dialog = await addOverlayYear(page, raw!)
    // 패널의 「추가된 데이터」 목록에 그 해가 있고 지울 수 있다.
    await expect(dialog.getByTestId(`overlay-remove-${OVERLAY_YEAR}`)).toBeVisible()
    await closeModal(page)

    // 히어로 「자료 현황」이 그 해를 "이 브라우저" 의 데이터로 밝힌다 — 숫자는 서버 응답이다.
    const panel = page.getByTestId('data-panel')
    await expect(panel).toContainText('추가 데이터')
    await expect(panel).toContainText(String(OVERLAY_YEAR))

    // 1단계 연도 칩에 그 해가 생긴다.
    await expect(yearChip(page, OVERLAY_YEAR)).toBeVisible()

    // 분석도 된다 — overlay 가 요청 본문에 실려 서버가 그 해를 포함해 계산한다.
    await pickUniversity(page, '호서대학교')
    await page.getByTestId('load-button').click()
    await expect(page.getByTestId('load-summary')).toBeVisible()
    await expect(page.getByTestId('load-summary')).toContainText('호서대학교')

    // 2단계 표에 그 해의 행이 있다. 요약 문구만 보면 서버가 overlay 를 무시해도 모른다.
    await page.getByTestId('next-button').click()
    await expect(
      page.getByTestId('year-table').getByRole('rowheader', { name: `${OVERLAY_YEAR}년` }),
    ).toBeVisible()
  })

  test('추가한 해를 지우면 칩과 자료 현황에서 사라진다', async ({ page }) => {
    const raw = newestRawFile()
    test.skip(raw === null, 'Raw data/ 에 공시 xlsx 가 없다')

    await page.goto('/')
    // 브라우저 컨텍스트는 테스트마다 새것이라 앞 테스트의 데이터가 남아 있지 않다. 직접 더한다.
    const dialog = await addOverlayYear(page, raw!)

    await dialog.getByTestId(`overlay-remove-${OVERLAY_YEAR}`).click()
    await expect(dialog.getByTestId(`overlay-remove-${OVERLAY_YEAR}`)).toHaveCount(0)
    await closeModal(page)

    // 칩이 사라지고, 자료 현황에서도 그 해가 빠진다 — 2031 은 어디에도 남지 않는다.
    // 지우면 데이터를 다시 받아 마법사가 새로 마운트된다. 그 사이 빈 화면을 상대로
    // "없다" 가 통과하지 않도록, 칩과 숫자가 다시 그려진 뒤에 본다.
    await expect(page.getByTestId('year-picker')).toBeVisible()
    await expect(yearChip(page, OVERLAY_YEAR)).toHaveCount(0)
    const panel = page.getByTestId('data-panel')
    await expect(panel).toContainText(/\d{4}/)
    await expect(panel).not.toContainText(String(OVERLAY_YEAR))

    // 기본 데이터는 그대로다 — 지운 뒤에도 분석이 된다.
    await pickUniversity(page, '호서대학교')
    await page.getByTestId('load-button').click()
    await expect(page.getByTestId('load-summary')).toContainText('호서대학교')
  })
})
