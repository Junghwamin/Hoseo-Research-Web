/**
 * 목록 거르기.
 *
 * 컴포넌트에서 분리한 이유는 이 규칙이 **정확성 문제**라서다 — 다 친
 * 이름으로 Enter 를 눌렀는데 다른 항목이 잡히면 사용자는 엉뚱한 대학의
 * 보고서를 만든다. 렌더 없이 검사할 수 있어야 한다.
 */
export function filterOptions(options: readonly string[], query: string): string[] {
  // 붙여넣기하면 공백이 딸려 온다. 그것 때문에 "없음" 이 뜨면 황당하다.
  const q = query.trim().toLowerCase()
  if (!q) return [...options]

  const matched = options.filter((o) => o.toLowerCase().includes(q))

  // 정확히 일치하는 것을 맨 앞으로.
  //
  // '단국대학교' 를 전부 치면 '단국대학교글로컬' 도 부분 일치한다. 목록
  // 순서대로면 먼저 나오는 쪽이 잡히는데, 사용자가 끝까지 친 이름이
  // 목록에 있으면 그게 의도다.
  const exact = matched.findIndex((o) => o.toLowerCase() === q)
  if (exact > 0) {
    const [hit] = matched.splice(exact, 1)
    matched.unshift(hit)
  }
  return matched
}
