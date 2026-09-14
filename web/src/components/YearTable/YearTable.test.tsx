import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'

import { YearTable } from './YearTable'

/**
 * 원본 Streamlit 판은 2단계에서 연도별 수치를 `dataframe` 으로 보여줬다.
 * 이관 후에는 차트의 `sr-only` 표만 남아, **눈으로 보는 사용자는 값을 짚어
 * 읽을 방법이 없었다** — 차트에서 0.5121 과 0.5118 을 구분할 수는 없다.
 */

const trend = {
  '2025': {
    papers: 150,
    faculty: 300,
    perCapita: 0.5,
    regionalRank: 3,
    nationalRank: 40,
  },
  '2026': {
    papers: 160,
    faculty: 305,
    perCapita: 0.5246,
    regionalRank: 2,
    nationalRank: 35,
  },
}

const averages = {
  '2025': { national: 0.44, regional: 0.47, compareGroup: 0.51 },
  '2026': { national: 0.45, regional: 0.48, compareGroup: null },
}

const rankChanges = {
  '2025': {
    regionalRank: 3,
    nationalRank: 40,
    regionalRankDelta: null,
    nationalRankDelta: null,
  },
  '2026': {
    regionalRank: 2,
    nationalRank: 35,
    regionalRankDelta: 1,
    nationalRankDelta: 5,
  },
}

function setup(props: Partial<React.ComponentProps<typeof YearTable>> = {}) {
  return render(
    <YearTable
      trend={trend}
      averages={averages}
      rankChanges={rankChanges}
      university="호서대학교"
      regionName="충청권"
      baseYear={2026}
      {...props}
    />,
  )
}

describe('YearTable', () => {
  it('연도를 오름차순으로 늘어놓는다', () => {
    setup()
    const years = screen
      .getAllByRole('rowheader')
      .map((el) => el.textContent)
    // JSON 객체 키는 순서가 보장되지 않는다. 뒤섞이면 추이를 잘못 읽는다.
    expect(years).toEqual(['2025년', '2026년'])
  })

  it('1인당논문수를 소수 넷째 자리까지 보여준다', () => {
    setup()
    // 반올림해서 0.52 로 보여주면 0.5246 과 0.5238 이 같아 보인다
    expect(screen.getByText('0.5246')).toBeInTheDocument()
  })

  it('권역 평균과 전국 평균을 같은 줄에서 비교할 수 있다', () => {
    setup()
    const row = screen.getByRole('row', { name: /2026년/ })
    expect(within(row).getByText('0.4800')).toBeInTheDocument()
    expect(within(row).getByText('0.4500')).toBeInTheDocument()
  })

  it('없는 값은 0 이 아니라 —', () => {
    // 0.0000 은 "논문이 없다" 는 뜻이 되어버린다
    setup({
      averages: {
        '2026': { national: null, regional: null, compareGroup: null },
      },
    })
    const row = screen.getByRole('row', { name: /2026년/ })
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('기준 연도를 표시한다', () => {
    setup()
    expect(screen.getByRole('row', { name: /2026년/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('권역 이름을 열 제목에 넣는다', () => {
    setup()
    // "권역 평균" 만 쓰면 어느 권역인지 알 수 없다 — V03 이 났던 축이다
    expect(screen.getByRole('columnheader', { name: '충청권 평균' })).toBeInTheDocument()
  })

  it('연도가 없어도 터지지 않는다', () => {
    setup({ trend: {}, averages: {}, rankChanges: {} })
    expect(screen.getByText('표시할 연도가 없다.')).toBeInTheDocument()
  })

  it('axe 위반이 없다', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})
