import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError, CLIENT_KEY_HEADER, type DatasetPreviewResponse } from './client'
import { clearClientKey, setClientKey } from './clientKey'
import { addOverlayYear, clearOverlay } from './overlay'

/**
 * 실패한 응답을 사람이 읽을 문장으로 바꾸는 계약과, 요청에 **맥락**(추가 데이터·
 * 브라우저 키)을 스스로 싣는 계약.
 *
 * 로컬은 HTTP/1.1 이라 `statusText` 가 차 있지만 Vercel 은 HTTP/2 라 비어 있다.
 * 그 차이를 테스트 안에서 재현하려고 `statusText` 를 비운 응답을 쓴다.
 */
function stubResponse(status: number, body: string, contentType: string) {
  const fetchMock = vi.fn(async () =>
    new Response(body, { status, statusText: '', headers: { 'Content-Type': contentType } }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function stubJson(body: unknown) {
  return stubResponse(200, JSON.stringify(body), 'application/json')
}

async function failure(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call()
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('실패해야 하는 호출이 성공했다')
}

function preview(year: number): DatasetPreviewResponse {
  const row = { year, name: '대학', faculty: 10, papers: 2, perCapita: 0.2, nationalRank: 1 }
  return {
    year,
    universities: 1,
    sourceFile: `${year}년.xlsx`,
    national: [row],
    regional: [{ ...row, regionName: '충청권', regionalRank: 1 }],
  }
}

/** 가짜 키는 실행 시점에 조립한다. 소스에 통짜로 적으면 비밀 스캐너가 문다. */
const FAKE_KEY = ['sk', 'test', 'x'.repeat(24)].join('-')

const 보고서 = { university: '호서대학교', year: 2026 }

function lastCall(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit | undefined] {
  const call = fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined]
  return call
}

beforeEach(() => {
  localStorage.clear()
  clearOverlay()
  clearClientKey()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API 오류 문구', () => {
  it('서버가 준 이유를 그대로 쓴다', async () => {
    stubResponse(404, JSON.stringify({ detail: '데이터에 없는 대학입니다' }), 'application/json')

    expect((await failure(() => api.report(보고서))).detail).toBe('데이터에 없는 대학입니다')
  })

  it('보고서의 422 도 이유를 보여준다 — detail 이 배열이다', async () => {
    stubResponse(
      422,
      JSON.stringify({
        detail: [{ loc: ['body', 'narratives'], msg: '서술 한 절은 20,000자까지입니다.' }],
      }),
      'application/json',
    )

    expect((await failure(() => api.report(보고서))).detail).toContain('20,000자까지')
  })

  it.each([
    [500, 'Internal Server Error', '잠시 뒤 다시 시도하세요'],
    [504, 'An error occurred with your deployment', '제한 시간'],
    [413, 'Request Entity Too Large', '너무 큽니다'],
  ])('앞단이 평문으로 답한 %i 에 숫자만 남기지 않는다', async (status, body, expected) => {
    stubResponse(status, body, 'text/plain')

    const error = await failure(() => api.report(보고서))

    expect(error.status).toBe(status)
    expect(error.detail).toContain(expected)
  })

  it('JSON 을 주는 호출과 업로드도 같은 문구를 쓴다', async () => {
    stubResponse(504, 'timeout', 'text/plain')
    expect((await failure(() => api.dataset())).detail).toContain('제한 시간')

    stubResponse(504, 'timeout', 'text/plain')
    expect((await failure(() => api.preprocess([]))).detail).toContain('제한 시간')

    stubResponse(504, 'timeout', 'text/plain')
    expect(
      (await failure(() => api.datasetPreview(new File(['x'], '2027년.xlsx')))).detail,
    ).toContain('제한 시간')
  })
})

describe('추가 데이터를 요청에 싣는다', () => {
  it('추가 데이터가 없으면 조회는 지금까지의 GET 이다', async () => {
    const fetchMock = stubJson({ years: [] })
    await api.dataset()
    const [url, init] = lastCall(fetchMock)
    expect(url).toBe('/api/data')
    expect(init?.method).toBeUndefined()
  })

  it('추가 데이터가 있으면 조회가 POST 로 바뀌고 본문에 overlay 가 실린다', async () => {
    addOverlayYear(preview(2027), 'a')
    const fetchMock = stubJson({ years: [] })

    await api.dataset()
    let [url, init] = lastCall(fetchMock)
    expect(url).toBe('/api/data')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body)).overlay.national[0].year).toBe(2027)

    await api.regions('호서대학교')
    ;[url, init] = lastCall(fetchMock)
    expect(url).toBe('/api/regions')
    expect(JSON.parse(String(init?.body))).toMatchObject({ university: '호서대학교' })

    await api.universities('충청권', 2027)
    ;[url, init] = lastCall(fetchMock)
    expect(url).toBe('/api/universities')
    expect(JSON.parse(String(init?.body))).toMatchObject({ region: '충청권', year: 2027 })
  })

  it('통계·서술·보고서 본문에 overlay 가 들어간다 (없으면 null)', async () => {
    const fetchMock = stubJson({ narratives: {}, failed: {} })
    await api.narrative(보고서)
    expect(JSON.parse(String(lastCall(fetchMock)[1]?.body)).overlay).toBeNull()

    addOverlayYear(preview(2027), 'a')
    await api.stats(보고서)
    expect(JSON.parse(String(lastCall(fetchMock)[1]?.body)).overlay.regional).toHaveLength(1)

    // jsdom 의 Blob 은 Node 의 Response 와 맞지 않는다 — 바이트 본문은 문자열로 준다.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('PK', { status: 200 })))
    await api.report(보고서)
    const reportBody = JSON.parse(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body))
    expect(reportBody.overlay.national[0].year).toBe(2027)
  })

  it('차트 Blob 은 POST 본문에 입력 전부와 overlay 를 싣고 dataVersion 은 싣지 않는다', async () => {
    addOverlayYear(preview(2027), 'a')
    const fetchMock = vi.fn(async () => new Response('png', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const blob = await api.chartBlob('rank', {
      university: '호서대학교',
      year: 2027,
      region: '충청권',
      compareGroup: ['A', 'B'],
      years: [2026, 2027],
      dataVersion: 3,
    })

    // jsdom 과 Node 의 Blob 클래스가 달라 instanceof 로 보지 않는다 — 모양으로 본다.
    expect(blob.size).toBe(3)
    const [url, init] = lastCall(fetchMock)
    expect(url).toBe('/api/chart/rank.png')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({
      university: '호서대학교',
      year: 2027,
      regionName: '충청권',
      compareGroup: ['A', 'B'],
      years: [2026, 2027],
    })
    expect(body.overlay.national[0].year).toBe(2027)
    expect(body).not.toHaveProperty('dataVersion')
  })

  it('미리보기는 multipart "file" 하나로 보내고 Content-Type 을 직접 정하지 않는다', async () => {
    const fetchMock = stubJson(preview(2027))
    const file = new File(['x'], '2027년_자료.xlsx')
    const result = await api.datasetPreview(file)

    expect(result.year).toBe(2027)
    const [url, init] = lastCall(fetchMock)
    expect(url).toBe('/api/dataset/preview')
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('file')).toBe(file)
    expect(init?.headers).toBeUndefined()
  })
})

describe('브라우저 키를 서술 요청에 싣는다', () => {
  it('키가 없으면 헤더가 없다', async () => {
    const fetchMock = stubJson({ narratives: {}, failed: {} })
    await api.narrative(보고서)
    const headers = lastCall(fetchMock)[1]?.headers as Record<string, string>
    expect(headers[CLIENT_KEY_HEADER]).toBeUndefined()
  })

  it('키가 있으면 서술 요청에만 헤더로 붙는다', async () => {
    setClientKey(FAKE_KEY)
    const fetchMock = stubJson({ narratives: {}, failed: {} })

    await api.narrative(보고서)
    expect((lastCall(fetchMock)[1]?.headers as Record<string, string>)[CLIENT_KEY_HEADER]).toBe(FAKE_KEY)

    await api.stats(보고서)
    expect((lastCall(fetchMock)[1]?.headers as Record<string, string>)[CLIENT_KEY_HEADER]).toBeUndefined()
  })
})
