/**
 * 「최근 N년」 프리셋.
 *
 * 체크박스만 두면 11개를 하나씩 눌러야 최근 3년이 된다. 실제로 자주 쓰는
 * 범위는 몇 개 안 되므로 한 번에 집도록 해 둔다.
 *
 * 컴포넌트에서 분리한 이유는 계산을 테스트하기 위해서다 — 화면을 띄우지
 * 않고도 "빈 목록", "가진 해보다 긴 N" 같은 경계를 확인할 수 있다.
 */
export interface YearPreset {
  readonly label: string
  /** 이 프리셋이 고르는 해. `available` 이 비면 빈 배열이다. */
  readonly pick: (available: readonly number[]) => number[]
}

/** 뒤에서 `n` 개. 가진 것보다 길게 요구해도 가진 만큼만 준다. */
export function lastN(available: readonly number[], n: number): number[] {
  if (n <= 0) return []
  return [...available].sort((a, b) => a - b).slice(-n)
}

export const YEAR_PRESETS: readonly YearPreset[] = [
  { label: '최근 3년', pick: (a) => lastN(a, 3) },
  { label: '최근 5년', pick: (a) => lastN(a, 5) },
  { label: '전체', pick: (a) => [...a].sort((x, y) => x - y) },
]

/**
 * 지금 선택이 어떤 프리셋과 같은가. 같은 것이 없으면 `null`.
 *
 * 눌린 프리셋을 표시하기 위한 것이다. 누른 뒤 체크 하나를 바꾸면 더는 그
 * 프리셋이 아니므로, 저장해 둔 "마지막에 누른 버튼" 을 쓰면 거짓말이 된다.
 */
export function matchingPreset(
  available: readonly number[],
  selected: readonly number[],
): string | null {
  const key = [...selected].sort((a, b) => a - b).join(',')
  for (const preset of YEAR_PRESETS) {
    if (preset.pick(available).join(',') === key) return preset.label
  }
  return null
}
