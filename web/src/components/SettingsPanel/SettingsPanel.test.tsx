import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { axe } from 'vitest-axe'

import type { SettingsResponse } from '../../api/client'
import { clearClientKey, getClientKey, setClientKey } from '../../api/clientKey'
import { SettingsPanel } from './SettingsPanel'

/**
 * Streamlit 판에서 설정 화면은 **어디서도 도달할 수 없는 죽은 라우트**였다.
 * 키가 없으면 "⚠ 미설정" 만 뜨고 사용자가 할 수 있는 일이 없었다(V16).
 *
 * 되살리면서 가장 중요한 계약은 하나다 — **키가 브라우저로 내려오지 않는다.**
 * 공개 사이트(canPersist=false)에서는 반대로 **키가 서버로 올라가 저장되지 않는다** —
 * 브라우저에만 남고 요청 헤더로만 간다.
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

const 공개사이트: SettingsResponse = { ...미설정, canPersist: false }

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

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  clearClientKey()
})
afterEach(() => vi.unstubAllGlobals())

describe('SettingsPanel — 서버 저장(persist)', () => {
  it('설정된 키는 마스킹된 힌트로만 보여준다', async () => {
    mockFetch({ get: () => 설정됨 })
    render(<SettingsPanel onClose={() => {}} />)

    await waitFor(() =>
      expect(screen.getByTestId('settings-status')).toHaveTextContent('설정됨'),
    )
    expect(screen.getByTestId('settings-status')).toHaveTextContent('sk-ab…7f2c')
    expect(screen.getByTestId('settings-status')).toHaveAttribute('data-mode', 'persist')
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

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장했습니다'))

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
      post: () => ({ status: 422, detail: "OpenAI 키는 'sk-' 로 시작해야 합니다." }),
    })
    const user = userEvent.setup()
    render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')

    await user.type(screen.getByTestId('api-key-input'), 'not-a-key')
    await user.click(screen.getByTestId('api-key-save'))

    // V16 은 "왜 안 되는지" 를 말해 주지 않던 결함이었다
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("'sk-' 로 시작해야 합니다"),
    )
  })

  it('axe 위반이 없다', async () => {
    mockFetch({ get: () => 미설정 })
    const { container } = render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('SettingsPanel — 브라우저 키(browser)', () => {
  it('쓸 수 없는 배포에서는 브라우저 키 폼을 보이고 서버 폼은 없다', async () => {
    mockFetch({ get: () => 공개사이트 })
    render(<SettingsPanel onClose={() => {}} />)

    const status = await screen.findByTestId('settings-status')
    expect(status).toHaveAttribute('data-mode', 'browser')
    expect(screen.getByTestId('client-key-status')).toHaveTextContent('저장된 키가 없습니다')
    expect(screen.getByText(/이 브라우저에만 저장/)).toBeInTheDocument()
    expect(screen.getByTestId('client-key-input')).toHaveAttribute('type', 'password')
    expect(screen.getByTestId('client-key-input')).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByTestId('client-key-clear')).toBeDisabled()
    // 눌러도 409 가 나는 서버 저장 폼은 렌더 트리에 없다
    expect(screen.queryByTestId('api-key-save')).toBeNull()
    expect(screen.queryByTestId('api-key-input')).toBeNull()
  })

  it('브라우저에 저장하면 localStorage 에 남고 마스킹된 상태로 보이며 onSaved 가 불린다', async () => {
    const fetchMock = mockFetch({ get: () => 공개사이트 })
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<SettingsPanel onClose={() => {}} onSaved={onSaved} />)
    await screen.findByTestId('settings-status')

    await user.type(screen.getByTestId('client-key-input'), FAKE_KEY)
    await user.click(screen.getByTestId('client-key-save'))

    expect(getClientKey()).toBe(FAKE_KEY)
    expect(screen.getByTestId('client-key-status')).toHaveTextContent('sk-te…xxxx')
    expect(screen.getByTestId('client-key-status')).not.toHaveTextContent(FAKE_KEY)
    expect(screen.getByTestId('client-key-input')).toHaveValue('')
    expect(onSaved).toHaveBeenCalledWith(공개사이트)
    // 서버로는 아무것도 올라가지 않는다
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('지우기는 저장소와 상태를 비우고 onSaved 를 부른다', async () => {
    mockFetch({ get: () => 공개사이트 })
    setClientKey(FAKE_KEY)
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<SettingsPanel onClose={() => {}} onSaved={onSaved} />)
    await screen.findByTestId('settings-status')

    expect(screen.getByTestId('client-key-status')).toHaveTextContent('이 브라우저에 저장된 키')
    await user.click(screen.getByTestId('client-key-clear'))

    expect(getClientKey()).toBeNull()
    expect(screen.getByTestId('client-key-status')).toHaveTextContent('저장된 키가 없습니다')
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('형식이 틀리면 보내지 않고 인라인으로 말한다', async () => {
    mockFetch({ get: () => 공개사이트 })
    const user = userEvent.setup()
    render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')

    await user.type(screen.getByTestId('client-key-input'), 'not-a-key')
    await user.click(screen.getByTestId('client-key-save'))

    expect(screen.getByRole('alert')).toHaveTextContent('sk- 로 시작해야 합니다')
    expect(getClientKey()).toBeNull()
  })

  it('공개 배포에서 서버에 키가 있어도 브라우저 키 폼을 보인다', async () => {
    mockFetch({ get: () => ({ ...설정됨, canPersist: false }) })
    render(<SettingsPanel onClose={() => {}} />)

    await screen.findByTestId('client-key-input')
    expect(screen.getByText(/브라우저 키가 있으면 그것을 먼저 씁니다/)).toBeInTheDocument()
    expect(screen.getByTestId('settings-status')).toHaveAttribute('data-mode', 'browser')
  })

  it('axe 위반이 없다', async () => {
    mockFetch({ get: () => 공개사이트 })
    const { container } = render(<SettingsPanel onClose={() => {}} />)
    await screen.findByTestId('settings-status')
    expect(await axe(container)).toHaveNoViolations()
  })
})
