import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'

import { CHART_KINDS } from '../../api/client'
import { ChartGallery } from './ChartGallery'

const base = {
  university: '호서대학교',
  year: 2026,
  regionName: '충청권',
  compareGroup: ['순천향대학교', '단국대학교'],
  years: [2024, 2025, 2026],
}

describe('ChartGallery', () => {
  it('넘긴 종류를 전부 그린다', () => {
    render(<ChartGallery {...base} kinds={['bar', 'avg', 'rank', 'compare']} />)
    for (const kind of ['bar', 'avg', 'rank', 'compare']) {
      expect(screen.getByTestId(`chart-${kind}`)).toBeInTheDocument()
    }
  })

  it('비교군을 주소에 실어 보낸다', () => {
    // **이게 빠지면 화면과 Word 의 그림이 갈라진다.** 서버는 비교군이 없으면
    // 기본 비교군으로 그리는데, 보고서는 사용자가 고른 비교군으로 만들어진다.
    render(<ChartGallery {...base} kinds={['compare']} />)
    const src = screen.getByRole('img').getAttribute('src')!
    const params = new URLSearchParams(src.split('?')[1])
    expect(params.getAll('compareGroup')).toEqual(['순천향대학교', '단국대학교'])
    expect(params.get('region')).toBe('충청권')
  })

  it('분석 연도도 주소에 실어 보낸다', () => {
    // 비교군과 같은 이유다. 빠지면 서버가 전 연도로 그리는데, 보고서는
    // 고른 연도로 만들어진다 — 화면엔 3개년, 문서엔 11개년이 실린다.
    render(<ChartGallery {...base} kinds={['rank']} />)
    const src = screen.getByRole('img').getAttribute('src')!
    const params = new URLSearchParams(src.split('?')[1])
    expect(params.getAll('years')).toEqual(['2024', '2025', '2026'])
  })

  it('연도가 null 이면 주소에도 없다', () => {
    render(<ChartGallery {...base} years={null} kinds={['rank']} />)
    const src = screen.getByRole('img').getAttribute('src')!
    expect(new URLSearchParams(src.split('?')[1]).getAll('years')).toEqual([])
  })

  it('비교군이 null 이면 주소에도 없다', () => {
    render(<ChartGallery {...base} compareGroup={null} kinds={['compare']} />)
    const src = screen.getByRole('img').getAttribute('src')!
    expect(new URLSearchParams(src.split('?')[1]).getAll('compareGroup')).toEqual([])
  })

  it('alt 에 무엇에 대한 그림인지 적는다', () => {
    render(<ChartGallery {...base} kinds={['rank']} />)
    // "차트 이미지" 는 그림을 못 보는 사람에게 아무 정보가 아니다
    expect(
      screen.getByRole('img', { name: '호서대학교 2026년 순위 변화 추이' }),
    ).toBeInTheDocument()
  })

  it('못 그리면 보고서에도 빠진다고 알린다', () => {
    render(<ChartGallery {...base} kinds={['avg']} />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('alert')).toHaveTextContent('보고서에도 이 그림은 빠진다')
  })

  it('한글 대학명이 주소에서 깨지지 않는다', () => {
    render(<ChartGallery {...base} kinds={['bar']} />)
    const src = screen.getByRole('img').getAttribute('src')!
    expect(new URLSearchParams(src.split('?')[1]).get('university')).toBe('호서대학교')
  })

  it('서버가 그리는 종류를 전부 알고 있다', () => {
    // 서버에 종류가 늘었는데 화면이 모르면 조용히 빠진다
    render(<ChartGallery {...base} kinds={CHART_KINDS} />)
    expect(screen.getAllByRole('img')).toHaveLength(CHART_KINDS.length)
  })

  it('axe 위반이 없다', async () => {
    const { container } = render(<ChartGallery {...base} kinds={['bar', 'rank']} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
