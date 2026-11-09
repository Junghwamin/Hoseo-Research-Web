import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChartKind } from '../../api/client'
import { chartImageKey, revokeChartImages, useChartImage, type ChartParams } from './useChartImage'

/**
 * overlay(브라우저가 든 추가 데이터)가 있을 때의 차트 경로.
 *
 * 서버 구현(T11 의 `api.chartBlob`)에 기대지 않는다 — `fetch` 와 objectURL 을 흉내
 * 내고, 훅이 **언제 받고 언제 버리는지**만 본다. jsdom 에는 `URL.createObjectURL`
 * 이 없어서 둘 다 직접 심는다.
 */

const params: ChartParams = {
  university: '호서대학교',
  year: 2026,
  region: '충청권',
  compareGroup: ['순천향대학교', '단국대학교'],
  years: [2024, 2025, 2026],
  dataVersion: 3,
}

/** PNG 한 장을 돌려주는 응답 흉내. 바이트 내용은 중요하지 않다 — objectURL 도 가짜다. */
function pngResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'image/png' }),
    blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
    json: async () => ({}),
  } as unknown as Response
}

/** 바깥에서 끝내 주기 전까지 멈춰 있는 요청. 「받는 도중」 을 재현한다. */
function deferred() {
  let resolve: (res: Response) => void = () => {}
  const promise = new Promise<Response>((r) => {
    resolve = r
  })
  return { promise, resolve: (res: Response) => resolve(res) }
}

let fetchMock: ReturnType<typeof vi.fn>
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  // 캐시는 모듈 상태다. 비우지 않으면 앞 테스트의 그림이 다음 테스트로 샌다.
  revokeChartImages()

  let n = 0
  createObjectURL = vi.fn(() => `blob:${++n}`)
  revokeObjectURL = vi.fn()
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL

  fetchMock = vi.fn(async () => pngResponse())
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderImage(kind: ChartKind, overlayKey: string | null, p: ChartParams = params) {
  return renderHook(
    (props: { kind: ChartKind; overlayKey: string | null }) =>
      useChartImage(props.kind, p, props.overlayKey),
    { initialProps: { kind, overlayKey } },
  )
}

describe('chartImageKey', () => {
  it('같은 입력은 같은 키, 데이터 판이 다르면 다른 키다', () => {
    expect(chartImageKey('rank', params, 'A')).toBe(chartImageKey('rank', { ...params }, 'A'))
    expect(chartImageKey('rank', params, 'A')).not.toBe(
      chartImageKey('rank', { ...params, dataVersion: 4 }, 'A'),
    )
    expect(chartImageKey('rank', params, 'A')).not.toBe(chartImageKey('bar', params, 'A'))
  })
})

describe('useChartImage — overlay 가 있을 때 (POST)', () => {
  it('overlayKey 가 있으면 POST 로 받아 blob: 주소를 만든다', async () => {
    const { result } = renderImage('rank', '2027@2026-11-09T00:00:00Z')

    expect(result.current.status).toBe('loading')
    expect(result.current.src).toBeNull()

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.src).toBe('blob:1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chart/rank.png',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('본문에 그림을 정하는 입력을 전부 싣고 dataVersion 은 싣지 않는다', async () => {
    // 비교군·연도가 빠지면 서버가 기본값으로 그린다 — 화면과 Word 가 갈라지는 바로
    // 그 사고다. dataVersion 은 브라우저 캐시용 값이라 POST 본문에는 들어갈 자리가 없다.
    const { result } = renderImage('compare', 'A')
    await waitFor(() => expect(result.current.status).toBe('ready'))

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(init.body as string)
    expect(body).toEqual(
      expect.objectContaining({
        university: '호서대학교',
        year: 2026,
        regionName: '충청권',
        compareGroup: ['순천향대학교', '단국대학교'],
        years: [2024, 2025, 2026],
      }),
    )
    expect(body).not.toHaveProperty('dataVersion')
  })

  it('같은 키로 두 번 그리면 한 번만 받는다', async () => {
    // 단계를 오가며 다시 마운트되거나 같은 그림이 동시에 둘 그려져도 matplotlib 은 한 번만 돈다.
    const first = renderImage('rank', 'A')
    const second = renderImage('rank', 'A')

    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    await waitFor(() => expect(second.result.current.status).toBe('ready'))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(second.result.current.src).toBe(first.result.current.src)

    // 언마운트 뒤 다시 마운트해도 캐시에서 바로 나온다.
    first.unmount()
    second.unmount()
    const third = renderImage('rank', 'A')
    expect(third.result.current.status).toBe('ready')
    expect(third.result.current.src).toBe('blob:1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('종류가 다르면 따로 받는다', async () => {
    const rank = renderImage('rank', 'A')
    const bar = renderImage('bar', 'A')
    await waitFor(() => expect(rank.result.current.status).toBe('ready'))
    await waitFor(() => expect(bar.result.current.status).toBe('ready'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(rank.result.current.src).not.toBe(bar.result.current.src)
  })

  it('overlay 가 바뀌면 그린 그림을 전부 버린다', async () => {
    // objectURL 캐시가 옛 그림을 들고 있으면 화면은 옛 데이터, Word 는 새 데이터다.
    const rank = renderImage('rank', 'A')
    const bar = renderImage('bar', 'A')
    await waitFor(() => expect(rank.result.current.status).toBe('ready'))
    await waitFor(() => expect(bar.result.current.status).toBe('ready'))
    rank.unmount()
    bar.unmount()

    revokeChartImages()

    expect(revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:2')

    // 비운 뒤에는 같은 키라도 다시 받는다.
    const again = renderImage('rank', 'A')
    await waitFor(() => expect(again.result.current.status).toBe('ready'))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(again.result.current.src).toBe('blob:3')
  })

  it('overlayKey 가 바뀌면 바깥이 부르지 않아도 스스로 전부 버린다', async () => {
    const { result, rerender } = renderImage('rank', 'A')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.src).toBe('blob:1')

    rerender({ kind: 'rank', overlayKey: 'B' })

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.src).toBe('blob:2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('받는 도중 overlay 가 바뀌면 도착한 옛 그림은 바로 버린다', async () => {
    const slow = deferred()
    fetchMock.mockImplementationOnce(() => slow.promise)

    const { result, rerender } = renderImage('rank', 'A')
    expect(result.current.status).toBe('loading')

    rerender({ kind: 'rank', overlayKey: 'B' })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fresh = result.current.src

    // 이제야 옛 요청이 끝난다. 만든 objectURL 은 곧바로 revoke 되고 화면은 그대로다.
    await act(async () => {
      slow.resolve(pngResponse())
      await slow.promise
    })
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledTimes(1))
    expect(result.current.src).toBe(fresh)
    expect(result.current.status).toBe('ready')
  })

  it('실패하면 error 이고 다시 그리기가 다시 받는다', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500 }) as Response)

    const { result } = renderImage('avg', 'A')
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.src).toBeNull()

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.src).toBe('blob:1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('받은 그림을 다시 그리면 옛 objectURL 을 버리고 새로 받는다', async () => {
    const { result } = renderImage('avg', 'A')
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.retry())
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1')
    await waitFor(() => expect(result.current.src).toBe('blob:2'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('useChartImage — overlay 가 없을 때 (GET)', () => {
  it('overlayKey 가 없으면 fetch 하지 않고 GET 주소를 쓴다', () => {
    // 기존 ChartGallery 테스트 전부가 이 경로다. 요청은 <img src> 가 하고
    // 브라우저 캐시가 재사용을 맡는다.
    const { result } = renderImage('rank', null)

    expect(result.current.status).toBe('ready')
    expect(result.current.src).toMatch(/^\/api\/chart\/rank\.png\?/)
    const query = new URLSearchParams(result.current.src!.split('?')[1])
    expect(query.get('university')).toBe('호서대학교')
    expect(query.getAll('compareGroup')).toEqual(['순천향대학교', '단국대학교'])
    expect(query.get('v')).toBe('3')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('다시 그리기는 주소에 r 을 붙여 브라우저의 실패 캐시를 피한다', () => {
    const { result } = renderImage('rank', null)
    expect(result.current.src).not.toMatch(/[&?]r=/)

    act(() => result.current.retry())
    expect(result.current.src).toMatch(/[&?]r=1\b/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
