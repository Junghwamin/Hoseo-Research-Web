import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import type { DatasetInfo, StatsResponse } from '../../../api/client'
import { INITIAL_STATE } from '../../../store/reducer'
import type { WizardState } from '../../../store/types'
import { SCOPE_NOTE, makeDataset, makeStats } from './stats.fixture'
import { Step2Metrics } from './Step2Metrics'
import type { StepActions } from './types'

/**
 * 2단계 지표 패널.
 *
 * 첫 테스트가 잠그는 결함: 서버의 `changeRate` 는 이미 퍼센트(9.7)인데 화면이
 * 다시 ×100 해서 `+970.0%` 를 찍었다. 같은 숫자를 YoYPanel 은 `describeChange` 로
 * 바르게 그렸으니, 두 곳이 같은 함수를 써야 한다.
 */

const actions: StepActions = {
  goto: vi.fn(),
  next: vi.fn(),
  reset: vi.fn(),
  setNarrative: vi.fn(),
  loadTarget: vi.fn(),
}

function renderStep(stats: StatsResponse, dataset: DatasetInfo | null = makeDataset()) {
  const state: WizardState = {
    ...INITIAL_STATE,
    step: 2,
    maxStep: 2,
    university: stats.university,
    year: stats.year,
    regionName: stats.regionName,
    stats,
  }
  return render(<Step2Metrics state={state} dataset={dataset} actions={actions} />)
}

describe('Step2Metrics', () => {
  it('1인당 논문 증감률을 서버 값 그대로 보여준다 — ×100 하지 않는다', () => {
    renderStep(makeStats())
    const deltas = screen.getAllByTestId('metric-delta')
    expect(deltas.some((d) => d.textContent?.includes('+9.7%'))).toBe(true)
    // 결함 시점의 표기. (표의 "0.1297" 뒤에 다른 셀이 붙으면 '970' 이 우연히
    // 생기므로 숫자 세 자리가 아니라 퍼센트 표기를 본다.)
    expect(document.body.textContent).not.toMatch(/970\.0%/)
  })

  it('전년 자료가 없으면 「전년 자료 없음」이고 NaN 이 없다', () => {
    renderStep(makeStats({ yoy: { top: [], bottom: [], target: null } }))
    expect(document.body.textContent).not.toMatch(/NaN/)
    expect(screen.getByText('전년 자료 없음')).toBeInTheDocument()
  })

  it('기준 연도가 최신이면 대학 수를 붙이고, 아니면 붙이지 않는다', () => {
    // 다른 해의 대학 수는 모른다 — 지어내지 않는다.
    const { unmount } = renderStep(makeStats({ year: 2026 }))
    const band = screen.getByRole('region', { name: '주요 지표' })
    expect(within(band).getByText('2026년 공시 · 사립 등재교 기준 · 133개교')).toBeInTheDocument()
    unmount()

    renderStep(makeStats({ year: 2025 }))
    const earlier = screen.getByRole('region', { name: '주요 지표' })
    expect(within(earlier).getByText('2025년 공시 · 사립 등재교 기준')).toBeInTheDocument()
    expect(within(earlier).queryByText(/개교/)).toBeNull()
  })

  it('지표 패널은 주홍 띠가 있는 panel 변형이다 — 2단계의 "답" 묶음', () => {
    renderStep(makeStats())
    expect(screen.getByRole('region', { name: '주요 지표' })).toHaveAttribute('data-variant', 'panel')
  })

  it('범위 문장을 패널 아래에 서버 문장 그대로 보여준다', () => {
    renderStep(makeStats())
    expect(screen.getByText(SCOPE_NOTE)).toBeInTheDocument()
  })

  it('데이터셋이 아직 없어도 패널은 그려진다', () => {
    renderStep(makeStats(), null)
    expect(screen.getByRole('region', { name: '주요 지표' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/undefined/)
  })
})
