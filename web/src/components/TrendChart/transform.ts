import type { TrendSeries } from './types'

/** recharts 가 먹는 행 모양: `{ year, [계열이름]: 값 }` */
export type ChartRow = { year: number } & Record<string, number | null>

/**
 * 계열들을 연도 기준으로 합쳐 행 배열로 만든다.
 *
 * 핵심 규칙 하나: **없는 값은 `null` 로 남긴다.** `0` 으로 메우면 선이 바닥을
 * 찍으면서 "그 해 실적이 0 이었다" 로 읽힌다. recharts 는 `null` 을 만나면
 * 선을 끊는데, 그게 사실에 맞는 표현이다.
 */
export function toChartRows(series: readonly TrendSeries[]): ChartRow[] {
  const years = new Set<number>()
  for (const s of series) {
    for (const p of s.points) years.add(p.year)
  }

  return [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const row: ChartRow = { year }
      for (const s of series) {
        const hit = s.points.find((p) => p.year === year)
        row[s.name] = hit ? hit.value : null
      }
      return row
    })
}

/** 값 없음(`null`)과 `0` 을 구분해 찍는다. */
export function formatValue(value: number | null | undefined, precision = 4): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(precision)
}

/** 그릴 것이 하나라도 있는가. 전부 null 이면 빈 차트를 그리지 않는다. */
export function hasAnyValue(series: readonly TrendSeries[]): boolean {
  return series.some((s) => s.points.some((p) => p.value !== null && p.value !== undefined))
}
