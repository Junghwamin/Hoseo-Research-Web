import { describe, it, expect } from 'vitest'

import { FEATURES, isEnabled } from './features'

/**
 * 계획 §6·§12-4 를 잠근다.
 *
 * Streamlit 판이 남긴 교훈: 미구현 모듈을 `disabled=True` 로 보여주면
 * 사용자는 "있는데 안 되는 기능" 으로 받아들인다. 꺼진 것은 없어야 한다.
 */
describe('기능 플래그', () => {
  it('연구실적만 켜져 있고 미구현 모듈은 꺼져 있다', () => {
    expect(isEnabled('research')).toBe(true)
    expect(isEnabled('educationCost')).toBe(false)
    expect(isEnabled('employment')).toBe(false)
  })

  it('설정은 되살린다 — Streamlit 판에서는 도달 불가한 죽은 라우트였다', () => {
    expect(isEnabled('settings')).toBe(true)
  })

  it('모든 플래그가 boolean 이다', () => {
    // 'coming-soon' 같은 제3의 상태를 만들면 다시 흐린 UI 가 생긴다
    for (const [key, value] of Object.entries(FEATURES)) {
      expect(typeof value, `${key} 가 boolean 이 아니다`).toBe('boolean')
    }
  })
})
