import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

import type { StatsResponse } from '../../../api/client'
import { INITIAL_STATE } from '../../../store/reducer'
import type { WizardState } from '../../../store/types'
import { makeDataset, makeStats } from './stats.fixture'
import { Step1Target } from './Step1Target'
import type { StepActions } from './types'

const actions: StepActions = {
  goto: vi.fn(),
  next: vi.fn(),
  reset: vi.fn(),
  setNarrative: vi.fn(),
  loadTarget: vi.fn(),
}

function renderStep(stats: StatsResponse | null) {
  const state: WizardState = {
    ...INITIAL_STATE,
    university: stats?.university ?? null,
    year: stats?.year ?? null,
    regionName: stats?.regionName ?? null,
    stats,
  }
  return render(<Step1Target state={state} dataset={makeDataset()} actions={actions} />)
}

beforeEach(() => {
  // 1단계는 권역·비교군 후보를 스스로 묻는다. 둘 다 빈 답을 준다.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      new Response(
        JSON.stringify(url.includes('/api/regions') ? { regions: ['충청권'] } : { rows: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  )
})

afterEach(() => vi.unstubAllGlobals())

describe('Step1Target — 분석 버튼', () => {
  it('통계가 있으면 보조 버튼 「다시 분석」이 된다', () => {
    // 검은 버튼은 한 화면에 하나다. 이미 불러온 뒤에는 「다음」이 주 행동이다.
    renderStep(makeStats())
    expect(screen.getByTestId('load-button')).toHaveTextContent('다시 분석')
  })

  it('통계가 없으면 주 행동 「분석하기」다', () => {
    renderStep(null)
    const button = screen.getByTestId('load-button')
    expect(button).toHaveTextContent('분석하기')
    expect(button).not.toHaveTextContent('다시')
  })

  it('안내문은 결과를 말하고 해라체가 없다', () => {
    renderStep(null)
    expect(screen.getByPlaceholderText('대학 이름 검색')).toBeInTheDocument()
    expect(screen.getByText(/기준 연도입니다/)).toBeInTheDocument()
    expect(screen.getByTestId('year-summary')).toHaveTextContent('지금은 3개년 전부입니다.')
    expect(document.body.textContent).not.toMatch(/고른다|보는 해다|전부다\./)
  })
})
