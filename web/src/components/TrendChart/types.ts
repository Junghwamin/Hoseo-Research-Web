/**
 * 연도별 추이 차트 계약.
 *
 * 대상 대학의 값과 비교선(전국·권역·비교군 평균)을 한 축에 겹쳐 그린다.
 * 데이터는 API 응답 그대로 받고, 차트가 통계를 다시 계산하지 않는다.
 */

export interface TrendSeriesPoint {
  readonly year: number
  /**
   * 그 해의 값. **`null` 은 "데이터 없음" 이고 `0` 과 다르다.**
   * 선은 없는 구간에서 끊겨야 한다 — 0 으로 메우면 실적이 0 이었던 것처럼 보인다.
   */
  readonly value: number | null
}

export interface TrendSeries {
  /** 범례에 쓸 이름. 예: `"호서대학교"`, `"충청권 평균"` */
  readonly name: string
  readonly points: readonly TrendSeriesPoint[]
  /**
   * 강조 여부. 대상 대학만 `true` 로 두고 비교선은 흐리게 그린다.
   * 색을 직접 받지 않는 이유: 팔레트는 tokens.css 가 단일 소스이기 때문이다.
   */
  readonly emphasis?: boolean
}

export interface TrendChartProps {
  readonly series: readonly TrendSeries[]
  /** y축 라벨. 예: `"1인당 논문 수(편)"` */
  readonly valueLabel: string
  /** 접근성용 차트 설명. 시각 정보를 텍스트로도 전달한다. */
  readonly description: string
  /** 소수 자리. 1인당논문수는 4자리, 논문 수는 1자리다. */
  readonly precision?: number
  readonly loading?: boolean
  readonly height?: number
}
