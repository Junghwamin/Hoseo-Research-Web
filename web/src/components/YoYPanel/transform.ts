import type { YoYDirection, YoYEntry } from './types'

/** 화면에 그릴 증감 한 건의 표현. 색·화살표·음성 라벨이 한 곳에서 정해진다. */
export interface YoYChangeView {
  /** 눈으로 읽을 문자열. 예: `"+9.7%"`, `"-3.2%"`, `"0.0%"`, `"신규"` */
  readonly label: string
  readonly direction: YoYDirection
  /** 스크린리더용. 화살표와 색은 음성으로 전달되지 않는다. */
  readonly srLabel: string
}

/** 1인당논문수는 소수 넷째 자리까지가 유효 자릿수다(0.1297 대 0.1182). */
const PRECISION = 4

/**
 * 증감률을 화면 표현으로 바꾼다.
 *
 * 두 가지를 절대 하지 않는다.
 *
 * 1. **`null` 을 0 으로 접지 않는다.** 이전값이 0 이면 증감률이 정의되지 않아
 *    서버가 `null` 을 보낸다. 이걸 0 으로 채우면 "+0.0%" 가 찍히고, 새로 생긴
 *    실적이 변화 없음으로 읽힌다 — V12 가 그 사고였다.
 *
 * 2. **절대값을 취한 뒤 부호를 다시 붙이지 않는다.** `toFixed` 가 음수 부호를
 *    이미 들고 있으므로 그대로 쓴다. 부호를 떼었다 붙이는 경로는 언젠가 한쪽을
 *    잃는다.
 *
 * 방향은 **`rate` 의 부호**가 정한다. 항목이 어느 목록(top/bottom)에 들어
 * 있는지는 보지 않는다 — 비교군이 작으면 서버의 `bottom` 에도 양수가 섞이는데,
 * 소속으로 판정하면 증가가 하락으로 표시된다.
 */
export function describeChange(rate: number | null | undefined): YoYChangeView {
  // 필드가 없는 것(`undefined`)도 null 과 같다. 서버 스키마가 옵셔널이라
  // 둘을 다르게 다루면 `undefined` 가 산술로 새어나가 "NaN%" 가 찍힌다.
  if (rate === null || rate === undefined) {
    return {
      label: '신규',
      direction: 'new',
      srLabel: '신규 실적, 이전 연도 값이 0이라 증감률을 낼 수 없음',
    }
  }

  const magnitude = Math.abs(rate).toFixed(1)

  if (rate > 0) {
    // 0.04 처럼 아주 작은 증가는 "+0.0%" 로 반올림된다. 숫자를 다듬기보다
    // 반올림 결과를 그대로 두고, 방향은 ▲ 와 음성 라벨이 따로 전달한다.
    return {
      label: `+${magnitude}%`,
      direction: 'up',
      srLabel: `${magnitude}퍼센트 증가`,
    }
  }

  if (rate < 0) {
    // 부호는 `toFixed` 가 이미 들고 있다. 음성 라벨만 "3.2퍼센트 감소" 처럼
    // 방향을 말로 하므로 거기서만 절대값을 쓴다.
    return {
      label: `${rate.toFixed(1)}%`,
      direction: 'down',
      srLabel: `${magnitude}퍼센트 감소`,
    }
  }

  // 정확히 0. `null` 과 달리 **측정된 값**이라 숫자를 남긴다. 부호는 붙이지 않는다.
  return { label: '0.0%', direction: 'flat', srLabel: '변동 없음' }
}

/**
 * 두 해의 값을 "과거 → 현재" 순서로 적는다.
 *
 * 인자 순서가 비교연도부터인 것이 이 함수의 요점이다(R-RS-03). 원본 Streamlit
 * 판은 `{기준연도} → {비교연도}` 로 찍었는데 기준연도가 최신이라 화면에
 * "2026 → 2025" 가 남았다. 시간이 거꾸로 흐르는 문장을 만들지 않으려면
 * 순서를 호출부의 기억이 아니라 함수 시그니처가 강제해야 한다.
 */
export function formatYearRange(
  compareYear: number,
  compareValue: number,
  baseYear: number,
  baseValue: number,
  precision: number = PRECISION,
): string {
  return (
    `${compareYear}년 ${compareValue.toFixed(precision)}` +
    ` → ${baseYear}년 ${baseValue.toFixed(precision)}`
  )
}

/**
 * 상위와 하위에 동시에 등장하는 대학명을 찾는다.
 *
 * 비교군이 6행 미만이면 상위 3·하위 3 을 뽑을 때 같은 대학이 양쪽에 들어간다.
 * 서버에서 고쳤지만 화면도 알아차려야 한다 — 조용히 그리면 "증가 1위이자
 * 감소 1위" 라는 말이 안 되는 표가 그대로 보고서에 실린다.
 */
export function findDuplicateNames(
  top: readonly YoYEntry[],
  bottom: readonly YoYEntry[],
): string[] {
  const bottomNames = new Set(bottom.map((e) => e.name))
  return [...new Set(top.map((e) => e.name).filter((n) => bottomNames.has(n)))]
}
