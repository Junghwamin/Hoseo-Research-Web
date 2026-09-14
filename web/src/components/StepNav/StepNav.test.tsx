import { render, screen } from '@testing-library/react'
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
      /이전 단계를 먼저 마쳐야 한다/,
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
})

describe('StepNav — 접근성', () => {
  it('axe 위반이 없다', async () => {
    const { container } = render(<StepNav current={2} maxStep={3} onSelect={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
