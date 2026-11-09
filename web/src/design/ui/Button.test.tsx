import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { Button } from './Button'

/**
 * 버튼의 계약은 모양이 아니라 **상태가 어떻게 드러나는가**다. 비활성을
 * 투명도로 흐리면 "죽은 버튼" 으로 읽혔고(설계 §5), 알약 모서리는 이 화면의
 * 실루엣이 아니다. 클래스 문자열을 보는 이유는 jsdom 이 Tailwind 를 계산하지
 * 않아서다 — 여기서 잠그는 것은 값이 아니라 어떤 토큰을 쓰는가다.
 */
describe('Button', () => {
  it('비활성은 투명도가 아니라 채움으로 표현한다', () => {
    render(<Button disabled>저장</Button>)
    const button = screen.getByRole('button', { name: '저장' })
    expect(button).toBeDisabled()
    expect(button.className).not.toMatch(/opacity/)
    expect(button.className).toMatch(/disabled:bg-\[var\(--surface-sunken\)\]/)
    expect(button.className).toMatch(/disabled:text-\[var\(--text-muted\)\]/)
  })

  it('직각이다 — radius-full 을 쓰지 않는다', () => {
    render(<Button>저장</Button>)
    const className = screen.getByRole('button').className
    expect(className).not.toMatch(/radius-full/)
    expect(className).toMatch(/\brounded-none\b/)
  })

  it('호버에 하드 그림자가 뜨고 누르면 그림자가 사라진다', () => {
    render(<Button variant="primary">저장</Button>)
    const className = screen.getByRole('button').className
    expect(className).toMatch(/hover:enabled:shadow-\[var\(--shadow-hard\)\]/)
    expect(className).toMatch(/active:enabled:shadow-none/)
    expect(className).toMatch(/active:enabled:translate-x-px/)
    expect(className).toMatch(/active:enabled:translate-y-px/)
  })

  it('ghost 는 선이 없으니 그림자도 띄우지 않는다', () => {
    render(<Button variant="ghost">닫기</Button>)
    expect(screen.getByRole('button').className).not.toMatch(/shadow-\[var\(--shadow-hard\)\]/)
  })

  it('라벨은 크기와 무관하게 본문 크기·600 굵기·+0.02em 자간이다', () => {
    render(<Button size="lg">분석 시작</Button>)
    const className = screen.getByRole('button').className
    expect(className).toMatch(/\btext-body\b/)
    expect(className).toMatch(/\bfont-semibold\b/)
    expect(className).toMatch(/tracking-\[0\.02em\]/)
    expect(className).not.toMatch(/\btext-lead\b/)
  })

  it('진행 중이면 누를 수 없고 라벨이 바뀐다', () => {
    render(
      <Button busy busyLabel="저장하는 중">
        저장
      </Button>,
    )
    const button = screen.getByRole('button', { name: '저장하는 중' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('기본 type 은 button 이다 — 폼 안에서 제출을 일으키지 않는다', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Button>확인</Button>
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
