import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'

expect.extend(axeMatchers)

afterEach(() => {
  cleanup()
})

// jsdom 에는 matchMedia 가 없다. 다크모드와 prefers-reduced-motion 을
// 읽는 컴포넌트가 테스트에서 터지지 않도록 최소 구현을 깐다.
// 기본값은 "질의한 조건이 거짓" 이다 — 테스트가 명시적으로 덮어쓰게 한다.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
