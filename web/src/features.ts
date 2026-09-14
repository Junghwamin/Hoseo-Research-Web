/**
 * 기능 플래그.
 *
 * 계획 §6: 미구현 기능은 **완전히 숨긴다.** `disabled` 로 흐리게 보여주지
 * 않는다 — Streamlit 판에서 홈 카드 2/3, 사이드바 모듈 절반이 "Coming Soon"
 * 장식이었고, 그게 사용자가 "불편하다" 고 한 실체다.
 *
 * 꺼진 항목은 렌더 트리에 **올라가지 않는다.** 나중에 켤 때는 이 값만 바꾼다.
 */
export const FEATURES = {
  /** 전임교원 연구실적 — 현재 유일하게 구현된 모듈 */
  research: true,

  /** 교육비환원율 — 미구현 (Streamlit 판 home.py:76-87, sidebar.py:32) */
  educationCost: false,

  /** 취업률 — 미구현 (Streamlit 판 home.py:92-103, sidebar.py:33) */
  employment: false,

  /**
   * 설정 — Streamlit 판에서는 라우트만 살아 있고 UI 어디에서도 도달할 수
   * 없는 죽은 코드였다. API 키 관리가 들어 있으므로 되살린다.
   */
  settings: true,
} as const

export type FeatureKey = keyof typeof FEATURES

export function isEnabled(key: FeatureKey): boolean {
  return FEATURES[key]
}
