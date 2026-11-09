import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { CHART_KINDS } from '../../api/client'
import { ChartGallery } from './ChartGallery'
import { revokeChartImages } from './useChartImage'

const base = {
  university: '호서대학교',
  year: 2026,
  regionName: '충청권',
  compareGroup: ['순천향대학교', '단국대학교'],
  years: [2024, 2025, 2026],
  dataVersion: 0,
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

  it('데이터 판을 주소에 실어 브라우저 캐시를 깬다', () => {
    // 응답에 max-age 가 붙어 있어서, 전처리로 데이터를 갈아끼워도 주소가
    // 같으면 브라우저가 서버에 묻지 않고 옛 PNG 를 5분간 계속 쓴다.
    render(<ChartGallery {...base} dataVersion={3} kinds={['rank']} />)
    const src = screen.getByRole('img').getAttribute('src')!
    expect(new URLSearchParams(src.split('?')[1]).get('v')).toBe('3')
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
    expect(screen.getByRole('alert')).toHaveTextContent('보고서에서도 빠집니다')
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

  it('종류별 비율 토큰으로 자리를 예약한다', () => {
    // 그림이 오기 전에 높이를 잡아 두지 않으면 5장이 차례로 들어오며 화면이 튄다.
    // 비율은 core/chart_generator.py 의 figsize 와 같은 토큰이다.
    render(<ChartGallery {...base} kinds={['rank']} />)
    expect(screen.getByRole('img').className).toMatch(/--chart-aspect-rank/)
  })

  it('실패한 그림만 다시 그릴 수 있다', () => {
    render(<ChartGallery {...base} kinds={['avg', 'bar']} />)
    fireEvent.error(screen.getAllByRole('img')[0])
    fireEvent.click(screen.getByRole('button', { name: '다시 그리기' }))

    const imgs = screen.getAllByRole('img')
    expect(imgs).toHaveLength(2)
    // 같은 주소를 다시 넣으면 브라우저가 실패를 캐시해 두고 재요청하지 않는다.
    expect(imgs[0].getAttribute('src')).toMatch(/[&?]r=1\b/)
    expect(imgs[1].getAttribute('src')).not.toMatch(/[&?]r=/)
  })

  it('figure 에 테두리가 없다 — 선은 섹션이 긋는다', () => {
    render(<ChartGallery {...base} kinds={['rank']} />)
    expect(screen.getByTestId('chart-rank').className).not.toMatch(/\bborder\b/)
  })

  it('캡션 번호는 Word 에 실리는 순서다', () => {
    // 문서의 그림 번호와 화면의 번호가 같아야 "3번 그림" 이라고 말할 수 있다.
    render(<ChartGallery {...base} kinds={['trend', 'avg', 'bar']} />)
    expect(screen.getByTestId('chart-trend')).toHaveTextContent('01')
    expect(screen.getByTestId('chart-avg')).toHaveTextContent('02')
    expect(screen.getByTestId('chart-bar')).toHaveTextContent('03')
  })

  it('axe 위반이 없다', async () => {
    const { container } = render(<ChartGallery {...base} kinds={['bar', 'rank']} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ChartGallery — 브라우저 추가 데이터(overlay)', () => {
  // jsdom 에는 fetch 도 objectURL 도 없다. 둘 다 심고 끝나면 걷는다.
  afterEach(() => {
    vi.unstubAllGlobals()
    revokeChartImages()
  })

  function stubPost() {
    URL.createObjectURL = vi.fn(() => 'blob:overlay-1') as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'image/png' }),
          blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
          json: async () => ({}),
        }) as unknown as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('overlayKey 가 있으면 POST 로 받은 blob: 주소를 그린다', async () => {
    // 추가 데이터는 요청 본문으로만 서버에 닿는다. GET 주소를 그대로 쓰면 서버는
    // 기본 데이터로 그리고, Word(POST 본문에 overlay 를 싣는다)와 그림이 갈라진다.
    const fetchMock = stubPost()
    render(<ChartGallery {...base} kinds={['rank']} overlayKey="2027@2026-11-09T00:00:00Z" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    const img = await screen.findByRole('img', { name: '호서대학교 2026년 순위 변화 추이' })
    expect(img).toHaveAttribute('src', 'blob:overlay-1')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chart/rank.png',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body).toEqual(
      expect.objectContaining({
        university: '호서대학교',
        year: 2026,
        compareGroup: ['순천향대학교', '단국대학교'],
        years: [2024, 2025, 2026],
      }),
    )
  })

  it('POST 가 실패하면 같은 오류 문구와 다시 그리기를 낸다', async () => {
    const fetchMock = stubPost()
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500 }) as Response)
    render(<ChartGallery {...base} kinds={['rank']} overlayKey="A" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('보고서에서도 빠집니다')

    fireEvent.click(screen.getByRole('button', { name: '다시 그리기' }))
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'blob:overlay-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('overlayKey 가 null 이면 GET 주소 그대로다', () => {
    const fetchMock = stubPost()
    render(<ChartGallery {...base} kinds={['rank']} overlayKey={null} />)
    expect(screen.getByRole('img').getAttribute('src')).toMatch(/^\/api\/chart\/rank\.png\?/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
