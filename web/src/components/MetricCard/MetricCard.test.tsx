import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, it, expect } from 'vitest'

import { MetricCard } from './MetricCard'
import type { MetricDelta } from './types'

const upDelta: MetricDelta = {
  label: '+5계단',
  direction: 'up',
  srLabel: '전국순위 5계단 상승',
}

const downDelta: MetricDelta = {
  label: '-3계단',
  direction: 'down',
  srLabel: '전국순위 3계단 하락',
}

describe('MetricCard — 기본 렌더', () => {
  it('라벨과 값을 그린다', () => {
    render(<MetricCard label="전국순위" value="71위" />)
    expect(screen.getByText('전국순위')).toBeInTheDocument()
    expect(screen.getByText('71위')).toBeInTheDocument()
  })

  it('caption 이 있으면 그리고, 없으면 그리지 않는다', () => {
    const { rerender } = render(
      <MetricCard label="전국순위" value="71위" caption="2026년 기준" />,
    )
    expect(screen.getByText('2026년 기준')).toBeInTheDocument()

    rerender(<MetricCard label="전국순위" value="71위" />)
    expect(screen.queryByText('2026년 기준')).not.toBeInTheDocument()
  })
})

describe('MetricCard — 증감 방향 (V09 회귀 잠금)', () => {
  // Streamlit 판에서 부호가 이중 반전되어 **개선이 빨간 하락으로** 표시됐다.
  // 방향은 direction 이 결정하고, 그 외 어떤 것도 뒤집지 못해야 한다.

  it('up 이면 상승 화살표와 up 데이터 속성을 붙인다', () => {
    render(<MetricCard label="전국순위" value="71위" delta={upDelta} />)
    const delta = screen.getByTestId('metric-delta')
    expect(delta).toHaveAttribute('data-direction', 'up')
    expect(delta).toHaveTextContent('▲')
    expect(delta).toHaveTextContent('+5계단')
  })

  it('down 이면 하락 화살표와 down 데이터 속성을 붙인다', () => {
    render(<MetricCard label="전국순위" value="74위" delta={downDelta} />)
    const delta = screen.getByTestId('metric-delta')
    expect(delta).toHaveAttribute('data-direction', 'down')
    expect(delta).toHaveTextContent('▼')
  })

  it('flat 이면 화살표를 붙이지 않는다', () => {
    render(
      <MetricCard
        label="전국순위"
        value="71위"
        delta={{ label: '변동 없음', direction: 'flat', srLabel: '전국순위 변동 없음' }}
      />,
    )
    const delta = screen.getByTestId('metric-delta')
    expect(delta).toHaveAttribute('data-direction', 'flat')
    expect(delta).not.toHaveTextContent('▲')
    expect(delta).not.toHaveTextContent('▼')
  })

  it('delta 가 없으면 증감 영역 자체를 렌더하지 않는다', () => {
    render(<MetricCard label="전국순위" value="71위" />)
    expect(screen.queryByTestId('metric-delta')).not.toBeInTheDocument()
  })

  it('라벨에 담긴 음수 부호를 지우지 않는다', () => {
    // V11 과 같은 계열의 사고 방지: 문자열을 다듬다가 부호를 잃으면 안 된다.
    render(
      <MetricCard
        label="1인당논문수"
        value="0.1182편"
        delta={{ label: '-0.0115편', direction: 'down', srLabel: '1인당논문수 0.0115편 감소' }}
      />,
    )
    expect(screen.getByTestId('metric-delta')).toHaveTextContent('-0.0115편')
  })

  it('색에만 의존하지 않도록 스크린리더 설명을 제공한다', () => {
    render(<MetricCard label="전국순위" value="71위" delta={upDelta} />)
    expect(screen.getByText('전국순위 5계단 상승')).toBeInTheDocument()
  })
})

describe('MetricCard — 경계 케이스', () => {
  it('value 가 null 이면 값 없음 기호를 그린다', () => {
    render(<MetricCard label="권역순위" value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('value 가 "0" 이면 값 없음이 아니라 0 을 그린다', () => {
    // 0 과 결측을 같게 다루면 "논문 0편" 이 "데이터 없음" 으로 둔갑한다.
    render(<MetricCard label="논문수" value="0편" />)
    expect(screen.getByText('0편')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('빈 문자열 값도 값 없음으로 취급하지 않는다', () => {
    render(<MetricCard label="비고" value="" />)
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('긴 한글 대학명이 들어가도 렌더가 깨지지 않는다', () => {
    const long = '한국과학기술원부설한국정보통신대학교세종캠퍼스'
    render(<MetricCard label={long} value="1위" />)
    expect(screen.getByText(long)).toBeInTheDocument()
  })

  it('loading 이면 스켈레톤을 그리고 값은 숨긴다', () => {
    render(<MetricCard label="전국순위" value="71위" loading />)
    expect(screen.getByTestId('metric-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('71위')).not.toBeInTheDocument()
  })

  it('HTML 문자열을 넣어도 마크업으로 해석하지 않는다', () => {
    // Streamlit 판의 V18(미이스케이프)이 났던 지점. React 는 기본 이스케이프하지만
    // 누군가 dangerouslySetInnerHTML 을 들이면 깨지므로 계약으로 잠근다.
    render(<MetricCard label="<b>굵게</b>" value="1위" />)
    expect(screen.getByText('<b>굵게</b>')).toBeInTheDocument()
    expect(document.querySelector('b')).toBeNull()
  })
})

describe('MetricCard — 접근성', () => {
  it('axe 위반이 없다', async () => {
    const { container } = render(
      <MetricCard label="전국순위" value="71위" caption="2026년 기준" delta={upDelta} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
