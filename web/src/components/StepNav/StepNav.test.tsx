import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, it, expect, vi } from 'vitest'

import { StepNav } from './StepNav'

describe('StepNav — 단계 게이팅', () => {
  it('도달한 단계만 누를 수 있다', () => {
    render(<StepNav current={2} maxStep={3} onSelect={() => {}} />)

    expect(screen.getByTestId('step-1')).toBeEnabled()
    expect(screen.getByTestId('step-2')).toBeEnabled()
    expect(screen.getByTestId('step-3')).toBeEnabled()
    // 4·5 는 아직 도달하지 않았다. V06 은 리셋 후에도 이게 열려 있어 크래시가 났다.
    expect(screen.getByTestId('step-4')).toBeDisabled()
    expect(screen.getByTestId('step-5')).toBeDisabled()
  })

  it('현재 단계를 aria-current 로 표시한다', () => {
    render(<StepNav current={3} maxStep={4} onSelect={() => {}} />)
    expect(screen.getByTestId('step-3')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByTestId('step-2')).not.toHaveAttribute('aria-current')
  })

  it('잠긴 단계는 왜 못 누르는지 음성으로 알린다', () => {
    // 흐릿한 모양만으로는 스크린리더 사용자가 이유를 알 수 없다
    render(<StepNav current={1} maxStep={1} onSelect={() => {}} />)
    expect(screen.getByTestId('step-4')).toHaveAccessibleName(
      /이전 단계를 먼저 마치세요/,
    )
  })

  it('도달한 단계를 누르면 그 번호를 넘긴다', async () => {
    const onSelect = vi.fn()
    render(<StepNav current={3} maxStep={3} onSelect={onSelect} />)

    await userEvent.click(screen.getByTestId('step-1'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('잠긴 단계를 눌러도 호출되지 않는다', async () => {
    const onSelect = vi.fn()
    render(<StepNav current={1} maxStep={1} onSelect={onSelect} />)

    await userEvent.click(screen.getByTestId('step-5'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('maxStep 이 5 면 전부 열린다', () => {
    render(<StepNav current={5} maxStep={5} onSelect={() => {}} />)
    for (let i = 1; i <= 5; i += 1) {
      expect(screen.getByTestId(`step-${i}`)).toBeEnabled()
    }
  })

  it('단계 이름을 그대로 보여준다', () => {
    render(<StepNav current={1} maxStep={5} onSelect={() => {}} />)
    expect(screen.getByText('데이터 설정')).toBeInTheDocument()
    expect(screen.getByText('보고서 생성')).toBeInTheDocument()
  })

  it('라벨은 DOM 에 정확히 한 노드다', () => {
    // 휴대폰용 요약 줄과 큰 화면용 탭이 같은 이름을 두 번 적으면, 정확 일치로
    // 라벨을 찾는 테스트와 보조 기술이 둘을 다 읽는다.
    render(<StepNav current={1} maxStep={5} onSelect={() => {}} />)
    expect(screen.getAllByText('데이터 설정')).toHaveLength(1)
  })

  it('잠긴 단계도 글자색으로 읽힌다 — opacity 를 쓰지 않는다', () => {
    // 50% 투명도는 바탕이 밝을수록 대비가 무너진다. 회색 글자 토큰이 대비를 지킨다.
    render(<StepNav current={1} maxStep={1} onSelect={() => {}} />)
    expect(screen.getByTestId('step-5').className).not.toMatch(/opacity/)
  })

  it('현재 단계 요약 줄은 "0n / 05 · 이름" 꼴의 텍스트 노드 하나다', () => {
    // 번호를 모노 span 으로 쪼개면 보조 기술이 "영삼 / 영오" 를 따로 읽는다.
    // 한글이 섞인 한 줄이므로 본문 글꼴 그대로 둔다(DESIGN.md §3).
    render(<StepNav current={3} maxStep={3} onSelect={() => {}} />)
    expect(screen.getByText('03 / 05 · 그래프 검토')).toBeInTheDocument()
  })

  it('큰 화면 탭의 번호는 두 자리 모노 아이브로다', () => {
    // "01 데이터 설정" — 번호는 Geist Mono, 이름은 Pretendard. 둘을 한 노드에
    // 넣으면 글꼴이 갈라지거나 이름 검색이 깨진다.
    render(<StepNav current={1} maxStep={5} onSelect={() => {}} />)
    const number = within(screen.getByTestId('step-1')).getByText('01')
    expect(number.className).toMatch(/\beyebrow-mono\b/)
  })

  it('휴대폰 점은 사각이다 — radius 토큰을 쓰지 않는다', () => {
    render(<StepNav current={1} maxStep={5} onSelect={() => {}} />)
    expect(screen.getByTestId('step-1').innerHTML).not.toMatch(/radius-full/)
  })
})

describe('StepNav — 접근성', () => {
  it('axe 위반이 없다', async () => {
    const { container } = render(<StepNav current={2} maxStep={3} onSelect={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
