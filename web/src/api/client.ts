import type { components } from './schema'

/**
 * API 클라이언트.
 *
 * 타입은 손으로 쓰지 않는다 — `npm run gen:api` 가 FastAPI 의 OpenAPI 에서
 * 생성한다. 서버 스키마가 바뀌면 여기가 타입 오류로 먼저 터진다.
 */

type S = components['schemas']

export type DatasetInfo = S['DatasetInfo']
export type StatsRequest = S['StatsRequest']
export type StatsResponse = S['StatsResponse']
export type TrendPoint = S['TrendPoint']
export type Averages = S['Averages']
export type RankChange = S['RankChange']
export type CompareRow = S['CompareRow']
export type YoYEntry = S['YoYEntry']
export type YoYChanges = S['YoYChanges']
export type RegionsResponse = S['RegionsResponse']
export type NarrativeRequest = S['NarrativeRequest']
export type NarrativeResponse = S['NarrativeResponse']
export type ReportRequest = S['ReportRequest']

/** 서버가 보낸 오류. `detail` 에 사람이 읽을 이유가 들어 있다. */
export class ApiError extends Error {
  // 생성자 파라미터 프로퍼티는 erasableSyntaxOnly 에서 금지된다
  // (타입만 지워서는 JS 가 되지 않는 문법이라 런타임 변환이 필요하다).
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    // FastAPI 는 오류를 {detail: ...} 로 준다. 422 는 detail 이 배열이다.
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') {
        detail = body.detail
      } else if (Array.isArray(body?.detail)) {
        detail = body.detail
          .map((e: { loc?: unknown[]; msg?: string }) =>
            `${e.loc?.slice(1).join('.') ?? ''}: ${e.msg ?? ''}`.trim(),
          )
          .join(', ')
      }
    } catch {
      /* 본문이 JSON 이 아니면 상태줄을 쓴다 */
    }
    throw new ApiError(res.status, detail)
  }

  return res.json() as Promise<T>
}

export const api = {
  dataset: () => request<DatasetInfo>('/api/data'),

  regions: (university: string) =>
    request<RegionsResponse>(
      `/api/regions?university=${encodeURIComponent(university)}`,
    ),

  stats: (body: StatsRequest) =>
    request<StatsResponse>('/api/stats', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  narrative: (body: NarrativeRequest) =>
    request<NarrativeResponse>('/api/narrative', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /**
   * Word 보고서를 받는다. JSON 이 아니라 바이트라 `request` 를 쓰지 않는다.
   *
   * 파일명은 서버가 Content-Disposition 에 RFC 5987 로 넣어 보낸다 —
   * 한글 파일명을 클라이언트가 지어내면 서버가 정한 규칙과 갈라진다.
   */
  report: async (body: ReportRequest): Promise<{ blob: Blob; filename: string }> => {
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`
      try {
        const err = await res.json()
        if (typeof err?.detail === 'string') detail = err.detail
      } catch {
        /* 본문이 JSON 이 아니면 상태줄을 쓴다 */
      }
      throw new ApiError(res.status, detail)
    }

    return {
      blob: await res.blob(),
      filename: parseFilename(res.headers.get('content-disposition')),
    }
  },
}

/** `filename*=UTF-8''...` 에서 이름을 꺼낸다. 없으면 무난한 기본값. */
export function parseFilename(disposition: string | null): string {
  const fallback = 'report.docx'
  if (!disposition) return fallback
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (!match) return fallback
  try {
    return decodeURIComponent(match[1])
  } catch {
    // 서버가 잘못 인코딩했어도 다운로드 자체는 되게 한다
    return fallback
  }
}

/**
 * 연도별 딕셔너리를 정렬된 배열로 편다.
 *
 * JSON 객체의 키는 문자열이고 순서가 보장되지 않는다. 차트에 그대로 넣으면
 * 연도가 뒤섞인다 — 반드시 이걸 거쳐서 쓴다.
 */
export function byYear<T>(map: Record<string, T>): Array<{ year: number } & T> {
  return Object.entries(map)
    .map(([y, v]) => ({ year: Number(y), ...v }))
    .sort((a, b) => a.year - b.year)
}
