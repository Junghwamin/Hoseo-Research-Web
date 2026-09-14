/**
 * 클래스 이름 합치기.
 *
 * `clsx` 를 넣지 않는 이유는 필요한 것이 이것뿐이라서다 — 조건부 클래스와
 * falsy 제거. 의존성 하나를 아끼는 것보다, **번들에 들어가는 것을 전부
 * 설명할 수 있는** 상태를 유지하는 쪽이 오프라인 설치본에 중요하다.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
