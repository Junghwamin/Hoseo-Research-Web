import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

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

/**
 * 배포 종류는 플래그가 아니다.
 *
 * 예전에는 `VITE_READONLY_DEPLOY` 빌드 플래그가 설정·데이터 갱신 메뉴를 통째로 껐다.
 * 그래서 공개 사이트에는 키를 넣을 자리도, 새 데이터를 더할 자리도 없었다. 지금은
 * 메뉴가 어디서나 켜져 있고 **동작 모드**(서버 저장 / 브라우저 저장)를 서버의
 * `canPersist` 가 고른다.
 */
describe('배포 종류와 무관하게 켜져 있다', () => {
  it('설정·데이터 메뉴가 켜져 있다', () => {
    expect(isEnabled('dataUpdate')).toBe(true)
    expect(isEnabled('settings')).toBe(true)
  })

  it('빌드 플래그로 메뉴를 끄는 코드가 없다', () => {
    // jsdom 환경에서 import.meta.url 은 file 스킴이 아니다 — 테스트 파일 경로에서 푼다.
    const src = readFileSync(join(dirname(expect.getState().testPath ?? ''), 'features.ts'), 'utf8')
    expect(src).not.toContain('VITE_READONLY_DEPLOY')
    expect(src).not.toContain('import.meta.env')
  })
})
