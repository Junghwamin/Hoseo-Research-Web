import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, it, expect, beforeAll } from 'vitest'

import { TrendChart } from './TrendChart'
import { formatValue, toChartRows } from './transform'
import type { TrendSeries } from './types'

// recharts 의 ResponsiveContainer 는 부모 크기를 재는데 jsdom 은 0 을 준다.
// 크기를 고정해 차트가 실제로 그려지게 한다.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 800,
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 400,
  })
})

const target: TrendSeries = {
  name: '호서대학교',
  emphasis: true,
  points: [
    { year: 2024, value: 0.1109 },
    { year: 2025, value: 0.1182 },
    { year: 2026, value: 0.1297 },
  ],
}

const regional: TrendSeries = {
  name: '충청권 평균',
  points: [
    { year: 2024, value: 0.19 },
    { year: 2025, value: 0.1943 },
    { year: 2026, value: 0.1975 },
  ],
}

// ---------------------------------------------------------------------------
// 변환 — 차트 라이브러리와 무관한 순수 로직이라 여기서 촘촘히 본다
// ---------------------------------------------------------------------------

describe('toChartRows', () => {
  it('연도를 오름차순으로 정렬한다', () => {
    const rows = toChartRows([
      {
        name: 'A',
        points: [
          { year: 2026, value: 3 },
          { year: 2024, value: 1 },
          { year: 2025, value: 2 },
        ],
      },
    ])
    expect(rows.map((r) => r.year)).toEqual([2024, 2025, 2026])
  })

  it('여러 계열의 연도를 합집합으로 모은다', () => {
    const rows = toChartRows([
      { name: 'A', points: [{ year: 2024, value: 1 }] },
      { name: 'B', points: [{ year: 2025, value: 2 }] },
    ])
    expect(rows.map((r) => r.year)).toEqual([2024, 2025])
  })

  it('없는 해는 null 로 남긴다 — 0 으로 메우지 않는다', () => {
    // 0 으로 메우면 "실적이 0 이었다" 로 읽힌다. 선은 끊겨야 한다.
    const rows = toChartRows([
      {
        name: 'A',
        points: [
          { year: 2024, value: 1 },
          { year: 2026, value: 3 },
        ],
      },
      { name: 'B', points: [{ year: 2025, value: 2 }] },
    ])
    const y2025 = rows.find((r) => r.year === 2025)!
    expect(y2025.A).toBeNull()
    expect(y2025.B).toBe(2)
  })

  it('명시적 null 값도 null 로 유지한다', () => {
    const rows = toChartRows([
      {
        name: 'A',
        points: [
          { year: 2024, value: null },
          { year: 2025, value: 0 },
        ],
      },
    ])
    expect(rows[0].A).toBeNull()
    expect(rows[1].A).toBe(0) // 0 은 값이다
  })

  it('빈 입력에 터지지 않는다', () => {
    expect(toChartRows([])).toEqual([])
    expect(toChartRows([{ name: 'A', points: [] }])).toEqual([])
  })
})

describe('formatValue', () => {
  it('지정한 소수 자리로 자른다', () => {
    expect(formatValue(0.12968, 4)).toBe('0.1297')
    expect(formatValue(52.6547, 1)).toBe('52.7')
  })

  it('null 은 값 없음 기호다', () => {
    expect(formatValue(null, 4)).toBe('—')
  })

  it('0 은 값 없음이 아니다', () => {
    expect(formatValue(0, 4)).toBe('0.0000')
  })
})

// ---------------------------------------------------------------------------
// 렌더
// ---------------------------------------------------------------------------

describe('TrendChart — 렌더', () => {
  it('범례에 계열 이름을 보여준다', () => {
    render(
      <TrendChart
        series={[target, regional]}
        valueLabel="1인당 논문 수(편)"
        description="호서대학교와 충청권 평균의 1인당 논문 수 추이"
      />,
    )
    expect(screen.getByText('호서대학교')).toBeInTheDocument()
    expect(screen.getByText('충청권 평균')).toBeInTheDocument()
  })

  it('차트를 img 역할로 노출하고 설명을 붙인다', () => {
    const description = '호서대학교의 1인당 논문 수가 2024년부터 상승했다'
    render(
      <TrendChart series={[target]} valueLabel="편" description={description} />,
    )
    expect(screen.getByRole('img', { name: description })).toBeInTheDocument()
  })

  it('시각 정보를 표로도 제공한다', () => {
    // 스크린리더 사용자는 SVG 선을 읽을 수 없다. 같은 수치를 표로 둔다.
    render(
      <TrendChart
        series={[target]}
        valueLabel="편"
        description="추이"
        precision={4}
      />,
    )
    const table = screen.getByRole('table', { hidden: true })
    expect(table).toHaveTextContent('2026')
    expect(table).toHaveTextContent('0.1297')
  })

  it('loading 이면 스켈레톤을 그리고 차트를 감춘다', () => {
    render(
      <TrendChart series={[target]} valueLabel="편" description="추이" loading />,
    )
    expect(screen.getByTestId('trend-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('계열이 없으면 빈 상태를 알린다', () => {
    render(<TrendChart series={[]} valueLabel="편" description="추이" />)
    expect(screen.getByText(/표시할 데이터가 없다/)).toBeInTheDocument()
  })

  it('모든 값이 null 인 계열도 빈 상태로 본다', () => {
    render(
      <TrendChart
        series={[{ name: 'A', points: [{ year: 2026, value: null }] }]}
        valueLabel="편"
        description="추이"
      />,
    )
    expect(screen.getByText(/표시할 데이터가 없다/)).toBeInTheDocument()
  })
})

describe('TrendChart — 접근성', () => {
  it('axe 위반이 없다', async () => {
    const { container } = render(
      <TrendChart
        series={[target, regional]}
        valueLabel="1인당 논문 수(편)"
        description="추이 차트"
        precision={4}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
