import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'

import type { UniversityRow } from '../../api/client'
import { CompareGroupPicker } from './CompareGroupPicker'

const row = (name: string, rank: number, perCapita: number): UniversityRow => ({
  name,
  faculty: 300,
  papers: perCapita * 300,
  perCapita,
  regionalRank: rank,
  nationalRank: rank + 10,
})

const rows = [
  row('한국기술교육대학교', 1, 0.6879),
  row('호서대학교', 2, 0.5),
  row('순천향대학교', 3, 0.48),
  row('단국대학교', 4, 0.41),
]

function setup(props: Partial<React.ComponentProps<typeof CompareGroupPicker>> = {}) {
  const onChange = vi.fn()
  const result = render(
    <CompareGroupPicker
      rows={rows}
      target="호서대학교"
      value={null}
      onChange={onChange}
      regionName="충청권"
      {...props}
    />,
  )
  return { onChange, user: userEvent.setup(), ...result }
}

describe('CompareGroupPicker', () => {
  it('분석 대상 자신은 후보에 없다', () => {
    setup()
    // 자기와 비교하는 막대는 의미가 없다
    expect(screen.queryByText('호서대학교')).toBeNull()
    expect(screen.getByText('순천향대학교')).toBeInTheDocument()
  })

  it('이름만이 아니라 지표도 함께 보여준다', () => {
    setup()
    // 이름만 보고 고르라는 것은 무엇을 고르는지 모르고 고르라는 말이다
    expect(screen.getByText(/권역 1위 · 0\.6879편/)).toBeInTheDocument()
  })

  it('고르면 그 목록이 올라간다', async () => {
    const { user, onChange } = setup()
    await user.click(screen.getByRole('checkbox', { name: /순천향대학교/ }))
    expect(onChange).toHaveBeenCalledWith(['순천향대학교'])
  })

  it('전부 해제하면 빈 배열이 아니라 null 이 된다', async () => {
    // **빈 배열을 서버에 보내면 기본 비교군으로 되돌아간다.**
    // 화면이 "0개 선택" 을 보여주면서 서버는 5개로 그리는 상태가 된다.
    const { user, onChange } = setup({ value: ['순천향대학교'] })
    await user.click(screen.getByRole('checkbox', { name: /순천향대학교/ }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('기본값 상태와 직접 고른 상태를 구분해 알린다', () => {
    const { rerender } = setup()
    expect(screen.getByTestId('compare-picker-summary')).toHaveTextContent(
      '서버 기본 비교군',
    )

    rerender(
      <CompareGroupPicker
        rows={rows}
        target="호서대학교"
        value={['순천향대학교', '단국대학교']}
        onChange={() => {}}
        regionName="충청권"
      />,
    )
    expect(screen.getByTestId('compare-picker-summary')).toHaveTextContent('2개교 선택')
  })

  it('기본 비교군으로 되돌릴 수 있다', async () => {
    const { user, onChange } = setup({ value: ['순천향대학교'] })
    await user.click(screen.getByRole('button', { name: '기본 비교군으로' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('후보가 자기 자신뿐이면 그렇다고 말한다', () => {
    setup({ rows: [row('호서대학교', 1, 0.5)] })
    expect(screen.getByText(/비교할 다른 대학이 없다/)).toBeInTheDocument()
  })

  it('불러오지 못하면 이유를 보여준다', () => {
    setup({ error: '없는 권역이다: 없는권' })
    expect(screen.getByRole('alert')).toHaveTextContent('없는 권역이다')
  })

  it('axe 위반이 없다', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})
