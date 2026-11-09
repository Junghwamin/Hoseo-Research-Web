import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'

import type { StatsResponse } from '../../api/client'
import { ContextBar } from './ContextBar'

const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

const stats = {
  university: '호서대학교',
  regionName: '충청권',
  year: 2026,
  years,
  trend: Object.fromEntries(
    years.map((y) => [
      String(y),
      { papers: 100, faculty: 1000, perCapita: 0.1, regionalRank: 1, nationalRank: 1 },
    ]),
  ),
  compare: Array.from({ length: 5 }, (_, i) => ({ name: `대학${i}` })),
} as unknown as StatsResponse

describe('ContextBar', () => {
  it('대상·권역·연도·개년·비교군을 한 줄로 보여준다', () => {
    render(<ContextBar stats={stats} onChange={() => {}} />)
    expect(screen.getByTestId('context-bar')).toHaveTextContent(
      '호서대학교 · 충청권 · 2026년 공시 · 11개년 · 비교군 5개교',
    )
  })

  it('개년은 실제로 표에 들어간 해의 수다 — 고른 연도 수가 아니다', () => {
    // 제주국제대처럼 일부 연도만 있는 대학은 11개년을 골라도 trend 가 10행이다.
    const partial = { ...stats, trend: { '2025': stats.trend['2025'], '2026': stats.trend['2026'] } }
    render(<ContextBar stats={partial} onChange={() => {}} />)
    expect(screen.getByTestId('context-bar')).toHaveTextContent('2개년')
  })

  it('변경을 누르면 onChange 가 불린다', async () => {
    const onChange = vi.fn()
    render(<ContextBar stats={stats} onChange={onChange} />)
    await userEvent.click(screen.getByTestId('context-change'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('axe 위반이 없다', async () => {
    const { container } = render(<ContextBar stats={stats} onChange={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
