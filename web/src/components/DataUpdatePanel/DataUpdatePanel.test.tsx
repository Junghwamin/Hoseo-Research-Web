import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { axe } from 'vitest-axe'

import type { DatasetPreviewResponse } from '../../api/client'
import { clearOverlay, getOverlay } from '../../api/overlay'
import { DataUpdatePanel, type DataUpdateMode } from './DataUpdatePanel'

const OK = {
  years: [2024, 2025, 2026],
  universities: 134,
  nationalRows: 402,
  regionalRows: 421,
  sourceFiles: ['2024년_x.xlsx', '2025년_x.xlsx', '2026년_x.xlsx'],
  savedFiles: ['2026년_x.xlsx'],
  backupPath: '.backup-20260915-101500',
}

function preview(year: number, n = 133): DatasetPreviewResponse {
  const row = { year, name: '호서대학교', faculty: 1018, papers: 132, perCapita: 0.1297, nationalRank: 71 }
  return {
    year,
    universities: n,
    sourceFile: `${year}년_자료.xlsx`,
    national: [row],
    regional: [{ ...row, regionName: '충청권', regionalRank: 17 }],
  }
}

function file(name: string, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  return new File(['xlsx-bytes'], name, { type })
}

function setup(mode: DataUpdateMode = 'persist') {
  const onUpdated = vi.fn()
  const onClose = vi.fn()
  const result = render(<DataUpdatePanel mode={mode} onUpdated={onUpdated} onClose={onClose} />)
  return { onUpdated, onClose, ...result }
}

function jsonFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

beforeEach(() => {
  localStorage.clear()
  clearOverlay()
  jsonFetch(OK)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DataUpdatePanel — 서버 갱신(persist)', () => {
  it('고르기 전에는 보낼 수 없다', () => {
    setup()
    expect(screen.getByTestId('preprocess-button')).toBeDisabled()
    // 브라우저 모드의 버튼은 렌더 트리에 없다 — 둘 다 보이면 어느 쪽이 서버를 바꾸는지 모른다.
    expect(screen.queryByTestId('overlay-add-button')).toBeNull()
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

    expect(screen.getByTestId('picked-files')).toHaveTextContent('연도가 없습니다')
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
    jsonFetch({ detail: '전처리가 실패했습니다. 올린 파일이 공시 xlsx 가 맞는지 확인하세요.' }, 400)
    const { onUpdated } = setup()
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2026년_자료.xlsx'))
    await userEvent.click(screen.getByTestId('preprocess-button'))

    await waitFor(() =>
      expect(screen.getByTestId('preprocess-error')).toHaveTextContent('공시 xlsx 가 맞는지'),
    )
    // 실패했는데 "갱신됐다" 고 알리면 화면이 데이터를 버린다
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it('파일 입력은 시각적으로만 감춘다 — 드롭존 라벨이 대신 보인다', () => {
    // display:none 이면 Playwright 의 toBeVisible 과 userEvent.upload 가 둘 다
    // 막힌다. sr-only 까지만 — 입력은 살아 있고 라벨이 눌리는 면이 된다.
    setup()
    const input = screen.getByTestId('raw-file-input')
    expect(input.className).toMatch(/sr-only/)
    expect(getComputedStyle(input).display).not.toBe('none')
    expect(screen.getByText(/끌어다 놓거나 눌러서 고르세요/)).toBeInTheDocument()
  })

  it('접근성 위반이 없다', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('DataUpdatePanel — 브라우저에 더하기(browser)', () => {
  it('영구 갱신 버튼은 없고 「분석에 추가」가 있으며 목록은 비어 있다', () => {
    setup('browser')
    expect(screen.queryByTestId('preprocess-button')).toBeNull()
    expect(screen.getByTestId('overlay-add-button')).toBeDisabled()
    expect(screen.getByText('추가된 데이터가 없습니다.')).toBeInTheDocument()
    expect(screen.getByText(/이 브라우저에만 저장/)).toBeInTheDocument()
  })

  it('파일마다 미리보기를 받아 그 해를 더하고 onUpdated 를 부른다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(preview(2027)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(preview(2028, 131)), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { onUpdated } = setup('browser')

    await userEvent.upload(screen.getByTestId('raw-file-input'), [
      file('2027년_자료.xlsx'),
      file('2028년_자료.xlsx'),
    ])
    await userEvent.click(screen.getByTestId('overlay-add-button'))

    await waitFor(() => expect(screen.getByTestId('overlay-result')).toHaveTextContent('2028년 131개교 추가됨'))
    expect(screen.getByTestId('overlay-result')).toHaveTextContent('2027년 133개교 추가됨')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.every(([url]) => url === '/api/dataset/preview')).toBe(true)
    expect(getOverlay()!.items.map((i) => i.year)).toEqual([2027, 2028])
    expect(onUpdated).toHaveBeenCalledTimes(2)

    // 목록에 두 해가 있고 각자 지울 수 있다
    const items = screen.getByTestId('overlay-items')
    expect(items).toHaveTextContent('2027년 · 133개교 · 2027년_자료.xlsx')
    expect(screen.getByTestId('overlay-remove-2028')).toBeInTheDocument()
  })

  it('제거하면 목록과 저장소에서 빠지고 onUpdated 를 부른다', async () => {
    jsonFetch(preview(2027))
    const { onUpdated } = setup('browser')
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2027년_자료.xlsx'))
    await userEvent.click(screen.getByTestId('overlay-add-button'))
    await screen.findByTestId('overlay-remove-2027')
    onUpdated.mockClear()

    await userEvent.click(screen.getByTestId('overlay-remove-2027'))

    expect(getOverlay()).toBeNull()
    expect(screen.queryByTestId('overlay-remove-2027')).toBeNull()
    expect(screen.getByText('추가된 데이터가 없습니다.')).toBeInTheDocument()
    expect(onUpdated).toHaveBeenCalledTimes(1)
  })

  it('모두 지우기', async () => {
    jsonFetch(preview(2027))
    const { onUpdated } = setup('browser')
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2027년_자료.xlsx'))
    await userEvent.click(screen.getByTestId('overlay-add-button'))
    await screen.findByTestId('overlay-clear')

    await userEvent.click(screen.getByTestId('overlay-clear'))
    expect(getOverlay()).toBeNull()
    expect(onUpdated).toHaveBeenCalled()
  })

  it('실패해도 고른 파일은 남고 이유를 말한다', async () => {
    jsonFetch({ detail: '전처리가 실패했습니다. 공시 xlsx 가 맞는지 확인하세요.' }, 400)
    const { onUpdated } = setup('browser')
    await userEvent.upload(screen.getByTestId('raw-file-input'), file('2027년_자료.xlsx'))
    await userEvent.click(screen.getByTestId('overlay-add-button'))

    await waitFor(() =>
      expect(screen.getByTestId('overlay-error')).toHaveTextContent('2027년_자료.xlsx 처리에 실패했습니다'),
    )
    expect(screen.getByTestId('overlay-error')).toHaveTextContent('다시 올리세요')
    expect(screen.getByTestId('picked-files')).toHaveTextContent('2027년_자료.xlsx')
    expect(onUpdated).not.toHaveBeenCalled()
    expect(getOverlay()).toBeNull()
  })

  it('접근성 위반이 없다', async () => {
    const { container } = setup('browser')
    expect(await axe(container)).toHaveNoViolations()
  })
})
