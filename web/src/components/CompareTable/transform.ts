/**
 * 비교표의 숫자 포맷.
 *
 * 표에서 분리한 이유는 두 가지다. 하나는 순수 함수라 렌더 없이 촘촘히
 * 검사할 수 있어서고, 하나는 자릿수 규칙이 도메인 지식이어서다. 1인당논문수는
 * 소수 넷째 자리에서 대학 순서가 갈리고, 논문수는 첫째 자리면 충분하다.
 * 이 규칙이 화면마다 흩어지면 같은 값이 다른 값처럼 보인다.
 */

/** 값 없음 기호. `0` 과 반드시 구분한다. */
const EMPTY = '—'

/**
 * 자릿수를 고정한 포매터.
 *
 * `useGrouping: true` 는 기본값(`"auto"`)과 같은 결과를 내지만 의도를 박아
 * 둔다. ko-KR 실측: auto 와 true 는 모두 1234 를 "1,234" 로 끊고, `"min2"` 만
 * "1234" 로 붙인다. 교원수는 네 자리가 흔해서 누군가 min2 로 바꾸면 읽기
 * 어려워진다. 모듈 로드 때 한 번만 만든다 — `Intl.NumberFormat` 생성은 비싸다.
 */
function fixed(fractionDigits: number): Intl.NumberFormat {
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  })
}

const INTEGER = fixed(0)
const ONE_DECIMAL = fixed(1)
const FOUR_DECIMALS = fixed(4)

/**
 * 숫자면 포맷하고, 아니면 값 없음 기호를 준다.
 *
 * `undefined` 까지 받는 이유는 OpenAPI 스키마가 순위 필드를 optional 로
 * 내보내기 때문이다. 키가 아예 없는 응답을 그대로 넘겨도 "0위" 같은 없는
 * 등수가 생기면 안 된다. `NaN` 도 같은 이유로 막는다 — `"NaN위"` 가 화면에
 * 찍히면 버그를 데이터 탓으로 오해하게 된다.
 */
function render(
  value: number | null | undefined,
  formatter: Intl.NumberFormat,
  unit: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY
  }
  return `${formatter.format(value)}${unit}`
}

/** 전임교원수: `931명`, `1,234명` */
export function formatFaculty(value: number | null | undefined): string {
  return render(value, INTEGER, '명')
}

/** 논문수: `368.8편`. 실적이 없으면 `0.0편` 이지 값 없음이 아니다. */
export function formatPapers(value: number | null | undefined): string {
  return render(value, ONE_DECIMAL, '편')
}

/** 1인당논문수: `0.3961`. 단위를 붙이지 않는다 — 열 머리가 이미 설명한다. */
export function formatPerCapita(value: number | null | undefined): string {
  return render(value, FOUR_DECIMALS, '')
}

/** 순위: `26위`. 권역 밖 대학은 `null` 로 와서 값 없음 기호가 된다. */
export function formatRank(value: number | null | undefined): string {
  return render(value, INTEGER, '위')
}
