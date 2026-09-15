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
export type UniversityRow = S['UniversityRow']
export type UniversitiesResponse = S['UniversitiesResponse']
export type SettingsResponse = S['SettingsResponse']
export type PreprocessResponse = S['PreprocessResponse']
export type ApiKeyRequest = S['ApiKeyRequest']

/** 서버가 그려 주는 차트 5종. Word 보고서에 들어가는 것과 같은 그림이다. */
export const CHART_KINDS = ['trend', 'bar', 'avg', 'rank', 'compare'] as const
export type ChartKind = (typeof CHART_KINDS)[number]

export const CHART_TITLES: Record<ChartKind, string> = {
  trend: '연도별 1인당 논문 수 추이',
  bar: '권역 내 전체 대학 비교',
  avg: '평균 대비 위치',
  rank: '순위 변화 추이',
  compare: '비교군 대학 비교',
}

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

  /** 권역 안의 대학 전체. 비교군 후보 목록이 여기서 나온다. */
  universities: (region: string, year: number) =>
    request<UniversitiesResponse>(
      `/api/universities?region=${encodeURIComponent(region)}&year=${year}`,
    ),

  settings: () => request<SettingsResponse>('/api/settings'),

  /**
   * API 키 저장.
   *
   * 키는 **올려보내기만** 한다. 응답에는 마스킹된 힌트만 들어 있다 —
   * 서버가 키를 되돌려주면 개발자 도구에 그대로 남는다.
   */
  saveApiKey: (apiKey: string) =>
    request<SettingsResponse>('/api/settings/api-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey } satisfies ApiKeyRequest),
    }),

  /**
   * Raw Excel 을 올려 데이터를 다시 만든다.
   *
   * JSON 이 아니라 multipart 라 `request` 를 쓰지 않는다 — `Content-Type` 을
   * 직접 정하면 브라우저가 붙이는 `boundary` 가 빠져 서버가 파싱하지 못한다.
   * FormData 를 주고 헤더는 건드리지 않는 것이 유일하게 맞는 방법이다.
   */
  preprocess: async (files: readonly File[]): Promise<PreprocessResponse> => {
    const form = new FormData()
    for (const file of files) form.append('files', file)

    const res = await fetch('/api/preprocess', { method: 'POST', body: form })
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`
      try {
        const body = await res.json()
        if (typeof body?.detail === 'string') detail = body.detail
      } catch {
        /* 본문이 JSON 이 아니면 상태줄을 쓴다 */
      }
      throw new ApiError(res.status, detail)
    }
    return res.json() as Promise<PreprocessResponse>
  },

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

/**
 * 서버 차트 이미지 주소.
 *
 * `<img src>` 로 쓴다 — fetch 로 받아 objectURL 을 만들면 브라우저 캐시를
 * 우회하게 되고, 단계를 오갈 때마다 matplotlib 이 다시 돈다.
 *
 * `compareGroup` 과 `years` 를 반드시 함께 보낸다. 빼면 서버가 기본 비교군·전
 * 연도로 그리는데, 사용자가 고른 것으로 만들어지는 **Word 보고서와 그림이
 * 달라진다.** 그림을 결정하는 입력은 하나도 빠뜨리지 않는다.
 */
export function chartUrl(
  kind: ChartKind,
  params: {
    university: string
    year: number
    region?: string | null
    compareGroup?: readonly string[] | null
    years?: readonly number[] | null
    /**
     * 데이터 판(`stats.dataVersion`).
     *
     * 서버는 쓰지 않는다 — **브라우저 캐시를 깨기 위한 것**이다. 응답에
     * `max-age=300` 이 붙어 있어서, 전처리로 데이터를 갈아끼워도 주소가
     * 같으면 브라우저가 서버에 묻지 않고 옛 PNG 를 5분간 계속 쓴다.
     */
    dataVersion?: number | null
  },
): string {
  const q = new URLSearchParams({
    university: params.university,
    year: String(params.year),
  })
  if (params.region) q.set('region', params.region)
  for (const name of params.compareGroup ?? []) q.append('compareGroup', name)
  for (const year of params.years ?? []) q.append('years', String(year))
  if (params.dataVersion != null) q.set('v', String(params.dataVersion))
  return `/api/chart/${kind}.png?${q.toString()}`
}
