import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

import { Pending } from './Pending'

/**
 * 로딩 표시는 **늦게** 나타나야 한다. 200ms 안에 끝나는 요청에 스켈레톤이
 * 번쩍이면 화면이 더 느려 보인다(지각 성능). 반대로 영영 안 나타나면 멈춘
 * 줄 안다.
 */
describe('Pending', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('200ms 전에는 아무것도 그리지 않는다', () => {
    const { container } = render(<Pending />)
    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(container.firstChild).toBeNull()
  })

  it('200ms 뒤에 aria-busy 블록을 그린다', () => {
    const { container } = render(<Pending />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('직각 블록이다 — radius 토큰을 쓰지 않는다', () => {
    const { container } = render(<Pending delayMs={0} />)
    act(() => {
      vi.advanceTimersByTime(0)
    })
    const block = container.querySelector('[aria-busy="true"]') as HTMLElement
    expect(block.className).toMatch(/\brounded-none\b/)
    expect(block.className).not.toMatch(/rounded-\[/)
  })

  it('지연을 바꿀 수 있고 role=status 는 만들지 않는다', () => {
    // 콤보박스의 status 가 페이지의 첫 role=status 로 남아야 한다(e2e 계약).
    const { container } = render(<Pending delayMs={0} label="차트를 그리는 중" />)
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.textContent).toContain('차트를 그리는 중')
  })
})
