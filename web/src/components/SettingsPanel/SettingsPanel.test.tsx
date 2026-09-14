import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { axe } from 'vitest-axe'

import type { SettingsResponse } from '../../api/client'
import { SettingsPanel } from './SettingsPanel'

/**
 * Streamlit 판에서 설정 화면은 **어디서도 도달할 수 없는 죽은 라우트**였다.
 * 키가 없으면 "⚠ 미설정" 만 뜨고 사용자가 할 수 있는 일이 없었다(V16).
 *
 * 되살리면서 가장 중요한 계약은 하나다 — **키가 브라우저로 내려오지 않는다.**
 */

const 미설정: SettingsResponse = {
  apiKeyConfigured: false,
  apiKeySource: null,
  apiKeyHint: null,
  canPersist: true,
}

const 설정됨: SettingsResponse = {
  apiKeyConfigured: true,
  apiKeySource: 'dotenv',
  apiKeyHint: 'sk-ab…7f2c',
  canPersist: true,
}

/** 가짜 키는 실행 시점에 조립한다. 소스에 통짜로 적으면 비밀 스캐너가 문다. */
const FAKE_KEY = ['sk', 'test', 'x'.repeat(24)].join('-')

function mockFetch(handlers: {
  get?: () => SettingsResponse
  post?: () => SettingsResponse | { status: number; detail: string }
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const isPost = init?.method === 'POST'
    const result = isPost ? handlers.post?.() : handlers.get?.()

    if (result && 'status' in result && 'detail' in result) {
      return new Response(JSON.stringify({ detail: result.detail }), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!result) throw new Error(`처리되지 않은 요청: ${url}`)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('SettingsPanel', () => {
  it('설정된 키는 마스킹된 힌트로만 보여준다', async () => {
    mockFetch({ get: () => 설정됨 })
    render(<SettingsPanel onClose={() => {}} />)

    await waitFor(() =>
      expect(screen.getByTestId('settings-status')).toHaveTextContent('설정됨'),
    )
    expect(screen.getByTestId('settings-status')).toHaveTextContent('sk-ab…7f2c')
  })

  it('미설정이면 그렇다고 말한다', async () => {
    mockFetch({ get: () => 미설정 })
    render(<SettingsPanel onClose={() => {}} />)
    await waitFor(() =>
      expect(screen.getByTestId('settings-status')).toHaveTextContent('설정되지 않음'),
    )
  })

  it('키를 저장하면 올려보내고 입력창을 비운다', async () => {
    const fetchMock = mockFetch({ get: () => 미설정, post: () => 설정됨 })
    const user = userEvent.setup()
    render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')

    await user.type(screen.getByTestId('api-key-input'), FAKE_KEY)
    await user.click(screen.getByTestId('api-key-save'))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장했다'))

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toEqual({ apiKey: FAKE_KEY })

    // 저장한 키를 화면에 남겨 둘 이유가 없다 — 어깨너머로도, 메모리에도.
    expect(screen.getByTestId('api-key-input')).toHaveValue('')
  })

  it('입력한 키는 화면에 평문으로 보이지 않는다', async () => {
    mockFetch({ get: () => 미설정 })
    const user = userEvent.setup()
    render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')

    const input = screen.getByTestId('api-key-input')
    await user.type(input, FAKE_KEY)
    expect(input).toHaveAttribute('type', 'password')
    // 브라우저가 평문으로 저장해 두는 것도 유출 경로다
    expect(input).toHaveAttribute('autocomplete', 'off')
  })

  it('빈 입력으로는 저장할 수 없다', async () => {
    mockFetch({ get: () => 미설정 })
    render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')
    expect(screen.getByTestId('api-key-save')).toBeDisabled()
  })

  it('서버가 거절하면 이유를 그대로 보여준다', async () => {
    mockFetch({
      get: () => 미설정,
      post: () => ({ status: 422, detail: "OpenAI 키는 'sk-' 로 시작한다." }),
    })
    const user = userEvent.setup()
    render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')

    await user.type(screen.getByTestId('api-key-input'), 'not-a-key')
    await user.click(screen.getByTestId('api-key-save'))

    // V16 은 "왜 안 되는지" 를 말해 주지 않던 결함이었다
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("'sk-' 로 시작한다"),
    )
  })

  it('쓸 수 없는 배포에서는 저장 폼을 숨기고 대안을 알려준다', async () => {
    mockFetch({ get: () => ({ ...미설정, canPersist: false }) })
    render(<SettingsPanel onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText(/환경변수/)).toBeInTheDocument())
    // 눌러도 409 가 나는 버튼을 보여줄 이유가 없다
    expect(screen.queryByTestId('api-key-save')).toBeNull()
  })

  it('axe 위반이 없다', async () => {
    mockFetch({ get: () => 미설정 })
    const { container } = render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')
    expect(await axe(container)).toHaveNoViolations()
  })
})
