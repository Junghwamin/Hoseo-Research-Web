import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Card } from './Card'

/**
 * Card 는 프레임이다 — 흰 면 + 1px 선 + 소프트 그림자. `panel` 은 그 위에
 * 4px 주홍 띠 하나를 더한 것이고, 페이지에서 가장 중요한 숫자 묶음 하나에만
 * 쓴다(DESIGN.md §5). 어느 변형인지는 `data-variant` 로 드러나야 e2e·스타일
 * 양쪽에서 가리킬 수 있다.
 */
describe('Card', () => {
  it('기본은 frame, panel 은 data-variant 로 드러난다', () => {
    render(
      <>
        <Card ariaLabel="기본">본문</Card>
        <Card ariaLabel="패널" variant="panel">
          본문
        </Card>
        <Card ariaLabel="평면" variant="plain">
          본문
        </Card>
      </>,
    )
    expect(screen.getByRole('region', { name: '기본' })).toHaveAttribute('data-variant', 'frame')
    expect(screen.getByRole('region', { name: '패널' })).toHaveAttribute('data-variant', 'panel')
    expect(screen.getByRole('region', { name: '평면' })).toHaveAttribute('data-variant', 'plain')
  })

  it('frame 은 1px 선과 소프트 그림자, panel 은 그 위에 4px 주홍 띠를 더한다', () => {
    render(
      <>
        <Card ariaLabel="기본">본문</Card>
        <Card ariaLabel="패널" variant="panel">
          본문
        </Card>
      </>,
    )
    const frame = screen.getByRole('region', { name: '기본' }).className
    const panel = screen.getByRole('region', { name: '패널' }).className
    expect(frame).toMatch(/border-\[var\(--border-strong\)\]/)
    expect(frame).toMatch(/shadow-\[var\(--shadow-soft\)\]/)
    expect(frame).not.toMatch(/border-t-4/)
    expect(panel).toMatch(/border-t-4/)
    expect(panel).toMatch(/border-t-\[var\(--accent\)\]/)
  })

  it('plain 은 선도 그림자도 없다', () => {
    render(
      <Card ariaLabel="평면" variant="plain">
        본문
      </Card>
    )
    const className = screen.getByRole('region', { name: '평면' }).className
    expect(className).not.toMatch(/border-\[var\(--border-strong\)\]/)
    expect(className).not.toMatch(/shadow-\[/)
  })

  it('직각이다 — radius 토큰을 쓰지 않는다', () => {
    render(<Card ariaLabel="기본">본문</Card>)
    expect(screen.getByRole('region', { name: '기본' }).className).not.toMatch(/rounded-\[/)
  })

  it('제목은 h3 이고 설명·행동이 머리글에 함께 들어간다', () => {
    render(
      <Card
        title="연도별 수치"
        description="보고서 표에 들어가는 값입니다."
        actions={<button type="button">내려받기</button>}
      >
        본문
      </Card>,
    )
    expect(screen.getByRole('heading', { level: 3, name: '연도별 수치' })).toBeInTheDocument()
    expect(screen.getByText('보고서 표에 들어가는 값입니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내려받기' })).toBeInTheDocument()
  })

  it('제목·설명·행동이 없으면 머리글을 그리지 않는다', () => {
    const { container } = render(<Card>본문</Card>)
    expect(container.querySelector('header')).toBeNull()
    expect(container.textContent).toBe('본문')
  })
})
