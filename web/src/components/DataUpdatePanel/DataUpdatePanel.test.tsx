import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { axe } from 'vitest-axe'

import { DataUpdatePanel } from './DataUpdatePanel'

const OK = {
  years: [2024, 2025, 2026],
  universities: 134,
  nationalRows: 402,
  regionalRows: 421,
  sourceFiles: ['2024년_x.xlsx', '2025년_x.xlsx', '2026년_x.xlsx'],
  savedFiles: ['2026년_x.xlsx'],
  backupPath: '.backup-20260915-101500',
}

function file(name: string, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  return new File(['xlsx-bytes'], name, { type })
}

function setup() {
  const onUpdated = vi.fn()
  const onClose = vi.fn()
  const result = render(<DataUpdatePanel onUpdated={onUpdated} onClose={onClose} />)
  return { onUpdated, onClose, ...result }
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(OK), { status: 200 })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DataUpdatePanel', () => {
  it('고르기 전에는 보낼 수 없다', () => {
    setup()
    expect(screen.getByTestId('preprocess-button')).toBeDisabled()
  })

  it('고르자마자 보내지 않는다 — 무엇이 올라가는지 먼저 보여준다', async () => {
    // 이 동작은 output/ 을 통째로 다시 만든다. 실수로 눌리는 일이 없어야 한다.
    setup()
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2026년_자료.xlsx'))

    expect(screen.getByTestId('picked-files')).toHaveTextContent('2026년_자료.xlsx')
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByTestId('preprocess-button')).toBeEnabled()
  })

  it('연도가 없는 파일명은 고를 때 막는다', async () => {
    // 서버도 막지만, 올린 뒤에 듣는 것보다 고를 때 아는 편이 낫다.
    setup()
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('연구실적.xlsx'))

    expect(screen.getByTestId('picked-files')).toHaveTextContent('연도가 없다')
    expect(screen.getByTestId('preprocess-button')).toBeDisabled()
  })

  it('무엇이 바뀌었는지 숫자로 말한다', async () => {
    // "완료됐습니다" 만 띄우면 올린 파일이 정말 반영됐는지 알 수 없다.
    const { onUpdated } = setup()
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2026년_자료.xlsx'))
    await userEvent.click(screen.getByTestId('preprocess-button'))

    await waitFor(() => expect(screen.getByTestId('preprocess-result')).toBeInTheDocument())
    const box = screen.getByTestId('preprocess-result')
    expect(box).toHaveTextContent('3개년')
    expect(box).toHaveTextContent('134개교')
    expect(box).toHaveTextContent('2024')
    expect(box).toHaveTextContent('2026')
    expect(onUpdated).toHaveBeenCalledWith(OK)
  })

  it('백업 위치를 알려준다', async () => {
    setup()
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2026년_자료.xlsx'))
    await userEvent.click(screen.getByTestId('preprocess-button'))

    await waitFor(() =>
      expect(screen.getByTestId('preprocess-result')).toHaveTextContent('.backup-20260915-101500'),
    )
  })

  it('multipart 로 보낸다 — Content-Type 을 직접 정하지 않는다', async () => {
    // 직접 정하면 브라우저가 붙이는 boundary 가 빠져 서버가 파싱하지 못한다.
    setup()
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2026년_자료.xlsx'))
    await userEvent.click(screen.getByTestId('preprocess-button'))

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/preprocess')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.headers).toBeUndefined()
  })

  it('실패하면 서버가 말한 이유를 그대로 보여준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: '전처리가 실패했다. 공시 xlsx 가 맞는지 확인할 것.' }), {
            status: 400,
          }),
      ),
    )
    const { onUpdated } = setup()
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2026년_자료.xlsx'))
    await userEvent.click(screen.getByTestId('preprocess-button'))

    await waitFor(() =>
      expect(screen.getByTestId('preprocess-error')).toHaveTextContent('공시 xlsx 가 맞는지'),
    )
    // 실패했는데 "갱신됐다" 고 알리면 화면이 데이터를 버린다
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it('접근성 위반이 없다', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})
