import { render, screen, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, it, expect } from 'vitest'

import { YoYPanel } from './YoYPanel'
import { describeChange, findDuplicateNames, formatYearRange } from './transform'
import type { YoYChanges, YoYEntry } from './types'

// 실제 2026년 충청권 데이터. 눈으로 확인할 때 진짜 숫자를 본다.
const hoseo: YoYEntry = {
  name: '호서대학교',
  changeRate: 9.7,
  baseValue: 0.1297,
  compareValue: 0.1182,
}

const entry = (over: Partial<YoYEntry>): YoYEntry => ({
  name: '아무대학교',
  changeRate: 1,
  baseValue: 0.2,
  compareValue: 0.1,
  ...over,
})

const changes = (over: Partial<YoYChanges> = {}): YoYChanges => ({
  top: [],
  bottom: [],
  target: null,
  ...over,
})

/** 세 props 가 모두 필수라 매번 같은 연도를 넘긴다. */
function renderPanel(over: Partial<YoYChanges> = {}) {
  return render(
    <YoYPanel changes={changes(over)} baseYear={2026} compareYear={2025} />,
  )
}

// ---------------------------------------------------------------------------
// 변환 — 화면과 무관한 순수 로직이라 여기서 촘촘히 본다
// ---------------------------------------------------------------------------

describe('describeChange — V12 회귀 잠금', () => {
  it('null 은 "신규" 이고, "+0.0%" 를 만들지 않는다', () => {
    // 이전값이 0 이면 증감률을 낼 수 없다. 0 으로 접는 순간 새로 생긴 실적이
    // "변화 없음" 으로 둔갑한다 — 그게 V12 였다.
    const got = describeChange(null)
    expect(got.label).toBe('신규')
    expect(got.direction).toBe('new')
    expect(got.label).not.toContain('0.0')
    expect(got.label).not.toContain('%')
  })

  it('0 은 null 과 다르게 다룬다 — 부호 없는 0.0%', () => {
    const got = describeChange(0)
    expect(got.label).toBe('0.0%')
    expect(got.direction).toBe('flat')
    expect(got.label).not.toContain('+')
  })

  it('양수에는 + 를 붙인다', () => {
    expect(describeChange(9.7).label).toBe('+9.7%')
    expect(describeChange(9.7).direction).toBe('up')
  })

  it('음수는 부호를 보존한다', () => {
    // 절대값을 취한 뒤 부호를 다시 붙이는 방식은 반드시 어딘가에서 부호를 잃는다.
    expect(describeChange(-3.2).label).toBe('-3.2%')
    expect(describeChange(-3.2).direction).toBe('down')
  })

  it('소수 둘째 자리에서 반올림해도 방향은 원래 부호를 따른다', () => {
    // -0.04 는 반올림하면 "-0.0" 이지만 분명히 감소다. 표기가 방향을 결정하면 안 된다.
    expect(describeChange(-0.04).direction).toBe('down')
    expect(describeChange(0.04).direction).toBe('up')
  })

  it('스크린리더 설명이 방향마다 다르다', () => {
    expect(describeChange(9.7).srLabel).toContain('증가')
    expect(describeChange(-3.2).srLabel).toContain('감소')
    expect(describeChange(null).srLabel).toContain('신규')
    expect(describeChange(0).srLabel).toContain('변동 없음')
  })
})

describe('formatYearRange — R-RS-03 회귀 잠금', () => {
  it('비교연도가 기준연도보다 먼저 온다', () => {
    // 원본은 "{기준연도} → {비교연도}" 라 화면에 "2026 → 2025" 가 찍혔다.
    const text = formatYearRange(2025, 0.1182, 2026, 0.1297)
    expect(text).toBe('2025년 0.1182 → 2026년 0.1297')
    expect(text.indexOf('2025')).toBeLessThan(text.indexOf('2026'))
  })

  it('기본 소수 자리는 4 다 — 1인당논문수의 유효 자릿수', () => {
    expect(formatYearRange(2025, 0.1, 2026, 0.2)).toBe('2025년 0.1000 → 2026년 0.2000')
  })

  it('0 을 값 없음으로 바꾸지 않는다', () => {
    expect(formatYearRange(2025, 0, 2026, 0.05)).toBe('2025년 0.0000 → 2026년 0.0500')
  })
})

describe('findDuplicateNames', () => {
  it('상위와 하위에 동시에 있는 이름을 찾는다', () => {
    const dup = findDuplicateNames(
      [entry({ name: 'A' }), entry({ name: 'B' })],
      [entry({ name: 'B' }), entry({ name: 'C' })],
    )
    expect(dup).toEqual(['B'])
  })

  it('겹치지 않으면 빈 배열이다', () => {
    expect(findDuplicateNames([entry({ name: 'A' })], [entry({ name: 'B' })])).toEqual([])
  })

  it('빈 입력에 터지지 않는다', () => {
    expect(findDuplicateNames([], [])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 렌더
// ---------------------------------------------------------------------------

describe('YoYPanel — 기본 렌더', () => {
  it('증가 상위와 감소 하위를 각각 영역으로 그린다', () => {
    renderPanel({ top: [entry({ name: '가대학교' })], bottom: [entry({ name: '나대학교' })] })
    // landmark(region)가 아니라 group 이다 — 패널이 둘 이상일 때
    // 같은 이름의 랜드마크가 중복되지 않게 한 결과다.
    expect(screen.getByRole('group', { name: /증가 상위/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /감소 하위/ })).toBeInTheDocument()
  })

  it('대상 대학을 별도 영역에 강조한다', () => {
    renderPanel({ target: hoseo })
    const target = screen.getByTestId('yoy-target')
    expect(target).toHaveTextContent('호서대학교')
    expect(target).toHaveTextContent('+9.7%')
  })

  it('각 항목에 이전 → 현재 값을 함께 보여준다', () => {
    renderPanel({ target: hoseo })
    const range = within(screen.getByTestId('yoy-target')).getByTestId('yoy-range')
    expect(range).toHaveTextContent('2025년 0.1182 → 2026년 0.1297')
  })

  it('연도 순서가 과거 → 현재다 (R-RS-03)', () => {
    // 항목 안에서만 본다. 제목 등 다른 곳의 연도 언급이 검사를 오염시키면
    // 통과·실패가 둘 다 엉뚱한 이유로 결정된다.
    renderPanel({ target: hoseo })
    const text = within(screen.getByTestId('yoy-target')).getByTestId('yoy-range')
      .textContent!
    expect(text.indexOf('2025')).toBeLessThan(text.indexOf('2026'))
  })
})

describe('YoYPanel — 증감률 표기 (V12 회귀 잠금)', () => {
  it('changeRate 가 null 이면 "신규" 이고 "+0.0%" 는 절대 나오지 않는다', () => {
    const { container } = renderPanel({
      top: [entry({ name: '신생대학교', changeRate: null, compareValue: 0, baseValue: 0.08 })],
    })
    expect(screen.getByText('신규')).toBeInTheDocument()
    // 텍스트가 여러 span 으로 쪼개져도 잡히도록 전체 문자열로 본다.
    expect(container.textContent).not.toContain('+0.0%')
    expect(container.textContent).not.toContain('0.0%')
  })

  it('null 과 0 을 한 화면에 두면 서로 다르게 찍힌다', () => {
    renderPanel({
      top: [entry({ name: '신생대학교', changeRate: null })],
      bottom: [entry({ name: '정체대학교', changeRate: 0 })],
    })
    expect(screen.getByText('신규')).toBeInTheDocument()
    expect(screen.getByText('0.0%')).toBeInTheDocument()
  })

  it('null 에는 화살표를 붙이지 않는다', () => {
    renderPanel({ top: [entry({ name: '신생대학교', changeRate: null })] })
    const item = screen.getByTestId('yoy-change')
    expect(item).toHaveAttribute('data-direction', 'new')
    expect(item).not.toHaveTextContent('▲')
    expect(item).not.toHaveTextContent('▼')
  })

  it('음수는 부호를 보존하고 ▼ 를 붙인다', () => {
    renderPanel({ bottom: [entry({ name: '감소대학교', changeRate: -3.2 })] })
    const item = screen.getByTestId('yoy-change')
    expect(item).toHaveTextContent('-3.2%')
    expect(item).toHaveAttribute('data-direction', 'down')
    expect(item).toHaveTextContent('▼')
  })

  it('양수는 + 와 ▲ 를 붙인다', () => {
    renderPanel({ top: [entry({ name: '증가대학교', changeRate: 9.7 })] })
    const item = screen.getByTestId('yoy-change')
    expect(item).toHaveTextContent('+9.7%')
    expect(item).toHaveAttribute('data-direction', 'up')
    expect(item).toHaveTextContent('▲')
  })

  it('방향을 색만으로 구분하지 않는다 — 스크린리더 라벨을 함께 낸다', () => {
    renderPanel({ top: [entry({ name: '증가대학교', changeRate: 9.7 })] })
    expect(screen.getByText(/9.7퍼센트 증가/)).toBeInTheDocument()
  })

  it('하위 목록에 든 양수도 증가로 표시한다', () => {
    // 비교군이 작으면 서버의 bottom 에 양수가 섞인다. 방향은 소속 목록이 아니라
    // changeRate 의 부호가 정한다 — 목록으로 판정하면 증가가 빨간 하락으로 찍힌다.
    renderPanel({ bottom: [entry({ name: '작은권역대학교', changeRate: 0.8 })] })
    const item = screen.getByTestId('yoy-change')
    expect(item).toHaveAttribute('data-direction', 'up')
    expect(item).toHaveTextContent('+0.8%')
  })
})

describe('YoYPanel — 중복 경고 (V12 잔여)', () => {
  it('상위와 하위에 같은 대학이 동시에 오면 경고를 낸다', () => {
    renderPanel({
      top: [entry({ name: '중복대학교', changeRate: 5 })],
      bottom: [entry({ name: '중복대학교', changeRate: 5 })],
    })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('중복대학교')
  })

  it('겹치지 않으면 경고를 내지 않는다', () => {
    renderPanel({
      top: [entry({ name: '가대학교' })],
      bottom: [entry({ name: '나대학교' })],
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('중복이어도 조용히 감추지 않고 목록은 그대로 그린다', () => {
    renderPanel({
      top: [entry({ name: '중복대학교' })],
      bottom: [entry({ name: '중복대학교' })],
    })
    expect(screen.getAllByText('중복대학교')).toHaveLength(3) // 경고 1 + 목록 2
  })
})

describe('YoYPanel — 경계 케이스', () => {
  it('top 과 bottom 이 모두 비면 안내 문구를 낸다', () => {
    renderPanel()
    expect(screen.getByText(/전년도 데이터가 없다/)).toBeInTheDocument()
  })

  it('목록이 비어도 target 이 있으면 대상은 그린다', () => {
    // 안내는 비교 목록이 없다는 뜻이지, 대상 실적이 없다는 뜻이 아니다.
    renderPanel({ target: hoseo })
    expect(screen.getByText(/전년도 데이터가 없다/)).toBeInTheDocument()
    expect(screen.getByTestId('yoy-target')).toHaveTextContent('호서대학교')
  })

  it('target 이 null 이어도 터지지 않는다', () => {
    renderPanel({ top: [entry({ name: '가대학교' })], target: null })
    expect(screen.queryByTestId('yoy-target')).not.toBeInTheDocument()
    expect(screen.getByText('가대학교')).toBeInTheDocument()
  })

  it('한쪽 목록만 비면 그 영역에만 해당 없음을 적는다', () => {
    renderPanel({ top: [entry({ name: '가대학교' })], bottom: [] })
    const bottom = screen.getByRole('group', { name: /감소 하위/ })
    expect(bottom).toHaveTextContent('해당 없음')
    expect(screen.queryByText(/전년도 데이터가 없다/)).not.toBeInTheDocument()
  })

  it('top·bottom 필드가 아예 없어도 빈 목록으로 읽는다', () => {
    // 서버 스키마가 두 필드를 옵셔널로 둔다. 호출부에 `?? []` 를 미루면
    // 한 군데는 반드시 빠지고, 거기서 undefined.length 로 터진다.
    render(
      <YoYPanel changes={{ target: hoseo }} baseYear={2026} compareYear={2025} />,
    )
    expect(screen.getByText(/전년도 데이터가 없다/)).toBeInTheDocument()
    expect(screen.getByTestId('yoy-target')).toHaveTextContent('호서대학교')
  })

  it('changeRate 필드가 없으면 null 과 똑같이 "신규" 다', () => {
    // undefined 가 산술로 새어나가면 "NaN%" 가 찍힌다. null 과 같은 길로 보낸다.
    const { container } = render(
      <YoYPanel
        changes={{ top: [{ name: '무필드대학교', baseValue: 0.08, compareValue: 0 }] }}
        baseYear={2026}
        compareYear={2025}
      />,
    )
    expect(screen.getByText('신규')).toBeInTheDocument()
    expect(container.textContent).not.toContain('NaN')
    expect(container.textContent).not.toContain('+0.0%')
  })

  it('긴 한글 대학명이 들어가도 렌더가 깨지지 않는다', () => {
    const long = '한국과학기술원부설한국정보통신대학교세종캠퍼스'
    renderPanel({ top: [entry({ name: long })] })
    expect(screen.getByText(long)).toBeInTheDocument()
  })

  it('HTML 문자열을 넣어도 마크업으로 해석하지 않는다', () => {
    renderPanel({ top: [entry({ name: '<b>굵게</b>' })] })
    expect(screen.getByText('<b>굵게</b>')).toBeInTheDocument()
    expect(document.querySelector('b')).toBeNull()
  })

  it('loading 이면 스켈레톤을 그리고 내용은 감춘다', () => {
    render(
      <YoYPanel
        changes={changes({ target: hoseo })}
        baseYear={2026}
        compareYear={2025}
        loading
      />,
    )
    expect(screen.getByTestId('yoy-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('yoy-target')).not.toBeInTheDocument()
  })
})

describe('YoYPanel — 접근성', () => {
  it('axe 위반이 없다', async () => {
    const { container } = render(
      <YoYPanel
        changes={changes({
          top: [entry({ name: '가대학교', changeRate: 12.4 })],
          bottom: [entry({ name: '나대학교', changeRate: -8.1 })],
          target: hoseo,
        })}
        baseYear={2026}
        compareYear={2025}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('패널을 두 번 그려도 id 충돌로 접근성이 깨지지 않는다', async () => {
    // 영역 제목 id 를 손으로 붙이면 여기서 중복 id 가 난다. 두 패널 모두
    // 목록을 채워야 제목이 실제로 렌더되고 그 id 가 검사 대상이 된다 —
    // 빈 목록으로 두면 제목이 아예 없어서 검사가 헛돈다.
    const filled = changes({
      top: [entry({ name: '가대학교', changeRate: 12.4 })],
      bottom: [entry({ name: '나대학교', changeRate: -8.1 })],
      target: hoseo,
    })
    const { container } = render(
      <>
        <YoYPanel changes={filled} baseYear={2026} compareYear={2025} />
        <YoYPanel changes={filled} baseYear={2025} compareYear={2024} />
      </>,
    )

    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id)
    expect(ids.length).toBeGreaterThan(0) // 검사할 id 가 실제로 있는지부터 본다
    expect(new Set(ids).size).toBe(ids.length)
    expect(await axe(container)).toHaveNoViolations()
  })
})
