import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SettingsResponse } from '../../../api/client'
import { clearClientKey, setClientKey } from '../../../api/clientKey'
import { INITIAL_STATE } from '../../../store/reducer'
import type { WizardState } from '../../../store/types'
import { makeDataset, makeStats } from './stats.fixture'
import { Step4Narrative } from './Step4Narrative'
import type { StepActions } from './types'

/**
 * 4단계는 서버의 키 상태와 브라우저 키를 **먼저 보고** 그에 맞는 화면을 그린다.
 *
 * V16 은 "⚠ 미설정" 만 뜨고 할 수 있는 일이 없던 결함이다. 그래서 키가 없을
 * 때는 이유와 다음 행동(설정 패널)을 같은 자리에 둔다. 다만 `generate-button` 은
 * 어느 상태에서도 DOM 에 남는다 — 눌렀을 때 서버가 503 과 이유를 돌려주는 경로가
 * e2e(V16) 계약이다.
 */

const 서버키없음_저장가능: SettingsResponse = {
  apiKeyConfigured: false,
  apiKeyHint: null,
  apiKeySource: null,
  canPersist: true,
}
const 서버키없음_공개사이트: SettingsResponse = { ...서버키없음_저장가능, canPersist: false }
const 서버키있음: SettingsResponse = {
  apiKeyConfigured: true,
  apiKeyHint: 'sk-ab…7f2c',
  apiKeySource: 'env',
  canPersist: true,
}

/** 가짜 키는 실행 시점에 조립한다. 소스에 통짜로 적으면 비밀 스캐너가 문다. */
const FAKE_KEY = ['sk', 'test', 'x'.repeat(24)].join('-')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** GET 은 설정, POST /api/narrative 는 `onNarrative` 가 정한다. */
function mockFetch(
  settings: SettingsResponse,
  onNarrative: (body: { keys: string[] }, call: number) => Response = (body) =>
    json({ narratives: Object.fromEntries(body.keys.map((k) => [k, `${k} 서술`])), failed: {} }),
) {
  let calls = 0
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('/api/settings')) return json(settings)
    if (url === '/api/narrative') {
      calls += 1
      return onNarrative(JSON.parse(String(init?.body)), calls)
    }
    throw new Error(`처리되지 않은 요청: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderStep(narratives = INITIAL_STATE.narratives) {
  const stats = makeStats()
  const actions: StepActions = {
    goto: vi.fn(),
    next: vi.fn(),
    reset: vi.fn(),
    setNarrative: vi.fn(),
    loadTarget: vi.fn(),
  }
  const state: WizardState = {
    ...INITIAL_STATE,
    step: 4,
    maxStep: 4,
    university: stats.university,
    year: stats.year,
    regionName: stats.regionName,
    stats,
    narratives,
  }
  render(<Step4Narrative state={state} dataset={makeDataset()} actions={actions} />)
  return actions
}

function narrativeCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url) === '/api/narrative')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { keys: string[] })
}

beforeEach(() => {
  localStorage.clear()
  clearClientKey()
})
afterEach(() => vi.unstubAllGlobals())

describe('Step4Narrative — 키 상태', () => {
  it('공개 사이트에서 키가 없으면 브라우저 키 폼을 임베드하고 생성 버튼은 그대로 둔다', async () => {
    mockFetch(서버키없음_공개사이트)
    renderStep()
    expect(await screen.findByTestId('client-key-input')).toBeInTheDocument()
    // 안내문(4단계)과 패널 설명(SettingsPanel)이 같은 말을 한다 — 둘 다 있어야 한다.
    expect(screen.getAllByText(/이 브라우저에만 저장/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/GPT 서술에는 OpenAI API 키가 필요합니다/)).toBeInTheDocument()
    expect(screen.getByTestId('generate-button')).toBeInTheDocument()
    expect(screen.queryByTestId('api-key-input')).toBeNull()
  })

  it('키가 없고 서버에 저장할 수 있으면 서버 저장 폼을 임베드한다', async () => {
    mockFetch(서버키없음_저장가능)
    renderStep()
    expect(await screen.findByTestId('api-key-input')).toBeInTheDocument()
    expect(screen.getByText(/OpenAI 키가 필요합니다/)).toBeInTheDocument()
    expect(screen.getByTestId('generate-button')).toBeInTheDocument()
  })

  it('서버에 키가 있으면 안내문이 없다', async () => {
    mockFetch(서버키있음)
    renderStep()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByText(/키가 필요합니다/)).toBeNull()
    expect(screen.getByTestId('generate-button')).toBeEnabled()
  })

  it('브라우저에 키가 있으면 공개 사이트에서도 안내문이 없다', async () => {
    setClientKey(FAKE_KEY)
    mockFetch(서버키없음_공개사이트)
    renderStep()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByText(/키가 필요합니다/)).toBeNull()
    expect(screen.queryByTestId('client-key-input')).toBeNull()
    expect(screen.getByTestId('generate-button')).toBeEnabled()
  })
})

describe('Step4Narrative — 일괄 생성', () => {
  it('비어 있는 절마다 요청을 따로 보낸다', async () => {
    const fetchMock = mockFetch(서버키있음)
    const actions = renderStep({ ...INITIAL_STATE.narratives, trend: '이미 쓴 글' })
    await waitFor(() => expect(fetch).toHaveBeenCalled())

    expect(screen.getByTestId('generate-button')).toHaveTextContent('비어 있는 3개 절 생성')
    await userEvent.click(screen.getByTestId('generate-button'))

    await waitFor(() => expect(narrativeCalls(fetchMock)).toHaveLength(3))
    const calls = narrativeCalls(fetchMock)
    expect(calls.every((c) => c.keys.length === 1)).toBe(true)
    expect(calls.map((c) => c.keys[0]).sort()).toEqual(['comparison', 'regional', 'yoy'])
    await waitFor(() => expect(actions.setNarrative).toHaveBeenCalledTimes(3))
    // 이미 쓴 글은 요청하지도, 덮어쓰지도 않는다
    expect(actions.setNarrative).not.toHaveBeenCalledWith('trend', expect.anything())
  })

  it('넷이 다 비었으면 라벨은 「4개 절 모두 생성」이다', async () => {
    mockFetch(서버키있음)
    renderStep()
    expect(screen.getByTestId('generate-button')).toHaveTextContent('4개 절 모두 생성')
  })

  it('일부만 실패하면 실패 목록을 보이고 나머지는 채운다', async () => {
    mockFetch(서버키있음, (body) =>
      body.keys[0] === 'yoy'
        ? json({ detail: 'RateLimitError: 잠시 뒤' }, 502)
        : json({ narratives: { [body.keys[0]!]: '글' }, failed: {} }),
    )
    const actions = renderStep()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await userEvent.click(screen.getByTestId('generate-button'))

    const failedList = await screen.findByTestId('narrative-failed')
    expect(failedList).toHaveTextContent('전년 대비 증감')
    expect(failedList).toHaveTextContent('잠시 뒤')
    expect(actions.setNarrative).toHaveBeenCalledTimes(3)
    expect(screen.queryByTestId('narrative-error')).toBeNull()
  })

  it('전부 같은 이유로 실패하면 한 문장으로 말한다 (키 없음 503)', async () => {
    mockFetch(서버키없음_저장가능, () =>
      json({ detail: 'OpenAI API 키가 없습니다. 설정에서 키를 넣으세요.' }, 503),
    )
    renderStep()
    await screen.findByTestId('api-key-input')
    await userEvent.click(screen.getByTestId('generate-button'))

    const error = await screen.findByTestId('narrative-error')
    expect(error).toHaveTextContent('OpenAI API 키가 없습니다')
    expect(screen.queryByTestId('narrative-failed')).toBeNull()
  })
})
