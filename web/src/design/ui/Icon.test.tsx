import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Icon, ICON_NAMES } from './Icon'

describe('Icon', () => {
  it('라벨이 없으면 장식이다', () => {
    render(<Icon name="check" />)
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('라벨이 있으면 이름을 가진 그림이다', () => {
    render(<Icon name="alert" label="경고" />)
    expect(screen.getByRole('img', { name: '경고' })).toBeInTheDocument()
  })

  it('이름 14개가 전부 획을 가진다', () => {
    expect(ICON_NAMES).toHaveLength(14)
    for (const name of ICON_NAMES) {
      const { unmount } = render(<Icon name={name} />)
      expect(
        document.querySelector('svg path, svg circle, svg line, svg rect'),
        name,
      ).not.toBeNull()
      unmount()
    }
  })

  it('데이터 추가·브라우저 키 화면이 쓰는 plus·x·upload·key 가 있다', () => {
    for (const name of ['plus', 'x', 'upload', 'key'] as const) {
      expect(ICON_NAMES).toContain(name)
      const { unmount } = render(<Icon name={name} />)
      expect(document.querySelector('svg path'), name).not.toBeNull()
      unmount()
    }
    // key-round 의 열쇠 구멍은 획이 아니라 채운 점이다 — fill 이 없으면 사라진다.
    render(<Icon name="key" />)
    expect(document.querySelector('svg circle')).toHaveAttribute('fill', 'currentColor')
  })

  it('기본 크기는 16 이고 글자색을 따른다', () => {
    render(<Icon name="download" />)
    const svg = document.querySelector('svg')
    expect(svg).toHaveAttribute('width', '16')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('fill', 'none')
  })
})
