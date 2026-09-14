/**
 * vitest-axe 가 확장하는 매처의 타입 선언.
 * 패키지가 Vitest 5 용 타입을 제공하지 않아 직접 선언한다.
 */
import 'vitest'
import type { AxeResults } from 'axe-core'

interface AxeMatchers<R = unknown> {
  toHaveNoViolations(): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends AxeMatchers<T> {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

export type { AxeResults }
