/**
 * 지표 카드 계약.
 *
 * 이 파일이 존재하는 이유는 V09 다. Streamlit 판에서 `data_loader` 는
 * "양수 = 개선" 으로 순위 변화를 계산했는데, 화면 쪽에서 한 번 더 뒤집어
 * **개선이 빨간 하락 화살표로 표시**됐다. 부호 규약을 말로만 두면 또 뒤집힌다.
 * 그래서 타입으로 못박는다.
 */

/** 지표가 좋아졌는가 나빠졌는가. 숫자의 부호가 아니라 **의미**다. */
export type DeltaDirection = 'up' | 'down' | 'flat'

export interface MetricDelta {
  /**
   * 화면에 찍을 변화량 문자열. 이미 포맷된 상태로 받는다.
   * 예: `"+5계단"`, `"-0.012편"`, `"신규"`
   *
   * 포맷을 컴포넌트가 하지 않는 이유: 순위(계단)·비율(%)·실수(편) 의
   * 표기 규칙이 서로 달라서, 카드가 알 필요가 없는 도메인 지식이 된다.
   */
  readonly label: string

  /**
   * 개선/악화 **판정 결과**. 원시 부호가 아니다.
   *
   * 순위는 작아지는 것이 개선이고(77위 → 71위), 논문 수는 커지는 것이
   * 개선이다. 그 해석은 호출자가 하고, 카드는 결과만 그린다.
   */
  readonly direction: DeltaDirection

  /**
   * 스크린리더용 설명. 색과 화살표만으로는 의미가 전달되지 않는다.
   * 예: `"전국순위 5계단 상승"`
   */
  readonly srLabel: string
}

export interface MetricCardProps {
  /** 지표 이름. 예: `"전국순위"` */
  readonly label: string

  /**
   * 이미 포맷된 본문 값. 예: `"71위"`, `"0.1297편"`, `"406명"`
   * `null` 이면 값 없음(`—`)으로 그린다 — 0 과 구분해야 한다.
   */
  readonly value: string | null

  /** 보조 설명. 예: `"2026년 기준"` */
  readonly caption?: string

  /** 증감 표시. 생략하면 증감 영역 자체를 렌더하지 않는다. */
  readonly delta?: MetricDelta

  /** 데이터 로딩 중이면 스켈레톤을 그린다. */
  readonly loading?: boolean
}
