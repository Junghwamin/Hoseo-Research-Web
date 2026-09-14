import { render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, it, expect } from 'vitest'

import { decideHeroMode, type HeroEnvironment } from './capability'
import { HomeHero } from './HomeHero'

const capable: HeroEnvironment = {
  prefersReducedMotion: false,
  hasWebGL: true,
  cores: 8,
  memoryGb: 8,
  viewportWidth: 1440,
}

describe('decideHeroMode — 언제 3D 를 포기하는가', () => {
  it('넉넉한 환경이면 3D 를 그린다', () => {
    expect(decideHeroMode(capable)).toBe('three')
  })

  it('모션을 줄이겠다고 했으면 무조건 정적이다', () => {
    // 성능이 아무리 좋아도 사용자 의사가 우선이다
    expect(decideHeroMode({ ...capable, prefersReducedMotion: true })).toBe('static')
  })

  it('WebGL 이 없으면 정적이다', () => {
    expect(decideHeroMode({ ...capable, hasWebGL: false })).toBe('static')
  })

  it('좁은 화면에서는 정적이다', () => {
    // 모바일에서 히어로가 본문을 밀어내면 분석 도구로서 쓸모가 없다
    expect(decideHeroMode({ ...capable, viewportWidth: 390 })).toBe('static')
  })

  it('코어가 적으면 정적이다', () => {
    expect(decideHeroMode({ ...capable, cores: 2 })).toBe('static')
  })

  it('메모리가 적으면 정적이다', () => {
    expect(decideHeroMode({ ...capable, memoryGb: 2 })).toBe('static')
  })

  it('사양을 모르는 것은 저사양이 아니다', () => {
    // Safari 는 deviceMemory 를 제공하지 않는다. 모른다고 끄면 맥 사용자
    // 전체가 정적 화면을 본다.
    expect(decideHeroMode({ ...capable, cores: undefined, memoryGb: undefined })).toBe(
      'three',
    )
  })

  it('경계값에서 정확히 갈린다', () => {
    expect(decideHeroMode({ ...capable, cores: 4 })).toBe('three')
    expect(decideHeroMode({ ...capable, cores: 3 })).toBe('static')
    expect(decideHeroMode({ ...capable, viewportWidth: 640 })).toBe('three')
    expect(decideHeroMode({ ...capable, viewportWidth: 639 })).toBe('static')
  })
})

describe('HomeHero — 렌더', () => {
  // jsdom 에는 WebGL 이 없다. 따라서 여기서는 **정적 경로만** 검사할 수 있고,
  // 그것이 맞다 — 3D 가 안 되는 환경에서 무엇이 보이는지가 중요하다.

  it('제목과 설명을 항상 보여준다', () => {
    render(<HomeHero title="연구실적 분석 포털" subtitle="대학알리미 기반 분석" />)
    expect(screen.getByRole('heading', { name: '연구실적 분석 포털' })).toBeInTheDocument()
    expect(screen.getByText('대학알리미 기반 분석')).toBeInTheDocument()
  })

  it('3D 를 못 그려도 글은 읽을 수 있다', async () => {
    // 장식이 실패해도 내용은 남아야 한다
    render(<HomeHero title="제목" subtitle="부제" />)
    await waitFor(() => {
      expect(screen.getByTestId('hero-static')).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: '제목' })).toBeInTheDocument()
  })

  it('캔버스는 장식이라 보조 기술에서 감춘다', async () => {
    render(<HomeHero title="제목" subtitle="부제" />)
    await waitFor(() => {
      const decoration = screen.getByTestId('hero-static')
      expect(decoration).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('긴 제목이 들어가도 렌더가 깨지지 않는다', () => {
    const long = '한국과학기술원부설한국정보통신대학교세종캠퍼스 연구실적 분석 포털'
    render(<HomeHero title={long} subtitle="부제" />)
    expect(screen.getByRole('heading', { name: long })).toBeInTheDocument()
  })

  it('HTML 문자열을 마크업으로 해석하지 않는다', () => {
    render(<HomeHero title="<b>굵게</b>" subtitle="부제" />)
    expect(screen.getByText('<b>굵게</b>')).toBeInTheDocument()
    expect(document.querySelector('h1 b')).toBeNull()
  })
})

describe('HomeHero — 접근성', () => {
  it('axe 위반이 없다', async () => {
    const { container } = render(<HomeHero title="제목" subtitle="부제" />)
    await waitFor(() => expect(screen.getByTestId('hero-static')).toBeInTheDocument())
    expect(await axe(container)).toHaveNoViolations()
  })
})
