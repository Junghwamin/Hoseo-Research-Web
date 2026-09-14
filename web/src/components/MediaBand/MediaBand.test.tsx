import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'

import { MediaBand } from './MediaBand'

describe('MediaBand', () => {
  it('제목과 본문을 보여준다', () => {
    render(
      <MediaBand eyebrow="마감" title="보고서에 무엇이 들어가나">
        <p>표 3개, 차트 5장, 서술 4개.</p>
      </MediaBand>,
    )
    expect(screen.getByRole('heading', { name: '보고서에 무엇이 들어가나' })).toBeVisible()
    expect(screen.getByText('표 3개, 차트 5장, 서술 4개.')).toBeVisible()
  })

  it('사진이 없어도 글은 그대로 읽힌다', () => {
    // 오프라인 설치본에서 파일 하나가 빠져도 구간이 통째로 사라지면 안 된다
    render(<MediaBand title="제목만" />)
    expect(screen.getByRole('heading', { name: '제목만' })).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('배경 사진은 장식이므로 보조 기술에서 감춘다', () => {
    const { container } = render(<MediaBand title="제목" imageSrc="/media/x.webp" />)
    const img = container.querySelector('img')!
    // alt="" + aria-hidden. 장식 사진에 설명을 달면 의미 없는 문장을 읽힌다.
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('aria-hidden', 'true')
  })

  it('배경 사진은 지연 로딩한다', () => {
    // 히어로와 달리 첫 화면 밖에 있다. 먼저 받으면 본문 로딩만 늦춘다.
    const { container } = render(<MediaBand title="제목" imageSrc="/media/x.webp" />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')
  })

  it('HTML 문자열을 마크업으로 해석하지 않는다', () => {
    render(<MediaBand title="<b>굵게</b>" />)
    expect(screen.getByText('<b>굵게</b>')).toBeInTheDocument()
    expect(document.querySelector('h2 b')).toBeNull()
  })

  it('axe 위반이 없다', async () => {
    const { container } = render(
      <MediaBand eyebrow="마감" title="제목" imageSrc="/media/x.webp">
        <p>본문</p>
      </MediaBand>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
