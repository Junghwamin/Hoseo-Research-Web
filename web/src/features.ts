/**
 * 기능 플래그.
 *
 * 계획 §6: 미구현 기능은 **완전히 숨긴다.** `disabled` 로 흐리게 보여주지
 * 않는다 — Streamlit 판에서 홈 카드 2/3, 사이드바 모듈 절반이 "Coming Soon"
 * 장식이었고, 그게 사용자가 "불편하다" 고 한 실체다.
 *
 * 꺼진 항목은 렌더 트리에 **올라가지 않는다.** 나중에 켤 때는 이 값만 바꾼다.
 *
 * 배포 종류는 여기서 가르지 않는다. 설정(키)과 데이터 갱신은 어디서나 켜져 있고,
 * **어떻게 동작할지**(서버에 저장 / 브라우저에만 저장)는 서버의 `/api/settings`
 * 가 돌려주는 `canPersist` 가 정한다. 빌드 시점 플래그로 가르면 같은 빌드가
 * 다른 서버에 올라갔을 때 메뉴와 동작이 어긋난다.
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

  /**
   * 데이터 갱신 — Raw Excel 업로드 → 전처리.
   *
   * 원본에는 있었고(`research.py:885`) 이관에서 엔드포인트째 빠졌다.
   */
  dataUpdate: true,
} as const

export type FeatureKey = keyof typeof FEATURES

export function isEnabled(key: FeatureKey): boolean {
  return FEATURES[key]
}
