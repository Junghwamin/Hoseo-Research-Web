import { render, screen, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, it, expect } from 'vitest'

import { CompareTable } from './CompareTable'
import {
  formatFaculty,
  formatPapers,
  formatPerCapita,
  formatRank,
} from './transform'
import type { CompareRow } from './types'

// 2026년 천안·아산 5개 대학 실제 값이다. 지어낸 숫자로 포맷을 맞춰두면
// 실제 자릿수(교원 세 자리, 논문 소수 넷째 자리)를 놓친다.
const soonchunhyang: CompareRow = {
  name: '순천향대학교',
  faculty: 931,
  papers: 368.77,
  perCapita: 0.3961,
  nationalRank: 26,
  regionalRank: 4,
}

const hoseo: CompareRow = {
  name: '호서대학교',
  faculty: 406,
  papers: 52.65,
  perCapita: 0.1297,
  nationalRank: 71,
  regionalRank: 17,
}

const nazarene: CompareRow = {
  name: '나사렛대학교',
  faculty: 147,
  papers: 3.98,
  perCapita: 0.027,
  nationalRank: 117,
  regionalRank: 27,
}

const CAPTION = '2026년 천안·아산 5개 대학 비교'

/** 행 머리에 붙는 "분석 대상" 때문에 이름 완전 일치로는 못 찾는다. */
function rowOf(name: string): HTMLElement {
  const header = screen.getByRole('rowheader', { name: new RegExp(name) })
  const tr = header.closest('tr')
  expect(tr, `${name} 행을 찾지 못했다`).not.toBeNull()
  return tr as HTMLElement
}

// ---------------------------------------------------------------------------
// 포맷 — 표와 무관한 순수 함수라 여기서 촘촘히 본다
// ---------------------------------------------------------------------------

describe('formatFaculty', () => {
  it('천단위를 끊고 단위를 붙인다', () => {
    expect(formatFaculty(1234)).toBe('1,234명')
  })

  it('네 자리 미만은 구분자 없이 그대로 쓴다', () => {
    expect(formatFaculty(931)).toBe('931명')
    expect(formatFaculty(406)).toBe('406명')
  })

  it('0 은 값 없음이 아니다', () => {
    expect(formatFaculty(0)).toBe('0명')
  })

  it('null 은 값 없음 기호다', () => {
    expect(formatFaculty(null)).toBe('—')
  })

  it('음수 부호를 지우지 않는다', () => {
    // 있을 수 없는 값이지만, 다듬다가 부호를 잃으면 더 나쁘다.
    expect(formatFaculty(-1234)).toBe('-1,234명')
  })
})

describe('formatPapers', () => {
  it('소수 1자리로 줄이고 단위를 붙인다', () => {
    expect(formatPapers(368.77)).toBe('368.8편')
    expect(formatPapers(52.65)).toBe('52.7편')
  })

  it('0 편은 값 없음이 아니라 0.0편이다', () => {
    // 결측과 실적 0 을 같은 기호로 적으면 "논문을 안 냈다" 가 "모르겠다" 가 된다.
    expect(formatPapers(0)).toBe('0.0편')
  })

  it('정수여도 소수 자리를 채운다', () => {
    expect(formatPapers(12)).toBe('12.0편')
  })

  it('null 은 값 없음 기호다', () => {
    expect(formatPapers(null)).toBe('—')
  })
})

describe('formatPerCapita', () => {
  it('소수 4자리를 유지한다', () => {
    // 대학 간 차이가 넷째 자리에서 갈린다. 반올림하면 순위가 뒤엉킨다.
    expect(formatPerCapita(0.3961)).toBe('0.3961')
    expect(formatPerCapita(0.027)).toBe('0.0270')
  })

  it('0 은 0.0000 이다', () => {
    expect(formatPerCapita(0)).toBe('0.0000')
  })

  it('null 은 값 없음 기호다', () => {
    expect(formatPerCapita(null)).toBe('—')
  })
})

describe('formatRank', () => {
  it('순위에 단위를 붙인다', () => {
    expect(formatRank(26)).toBe('26위')
    expect(formatRank(117)).toBe('117위')
  })

  it('null 은 값 없음 기호다 — 0 과 구분한다', () => {
    expect(formatRank(null)).toBe('—')
    expect(formatRank(0)).toBe('0위')
  })

  it('undefined 도 값 없음으로 본다', () => {
    // OpenAPI 스키마가 regionalRank 를 optional 로 내보낸다. 키가 없는 응답을
    // 그대로 넘겨도 "0위" 같은 헛것이 나오면 안 된다.
    expect(formatRank(undefined)).toBe('—')
  })

  it('NaN 을 숫자처럼 찍지 않는다', () => {
    expect(formatRank(Number.NaN)).toBe('—')
  })
})

// ---------------------------------------------------------------------------
// 렌더
// ---------------------------------------------------------------------------

describe('CompareTable — 표 구조', () => {
  it('caption 을 table 의 caption 요소로 그린다', () => {
    render(<CompareTable rows={[hoseo]} caption={CAPTION} />)
    const caption = screen.getByRole('table').querySelector('caption')
    expect(caption).not.toBeNull()
    expect(caption).toHaveTextContent(CAPTION)
  })

  it('여섯 개 열 머리를 scope=col 로 단다', () => {
    render(<CompareTable rows={[hoseo]} caption={CAPTION} />)
    const headers = screen.getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toEqual([
      '학교명',
      '전임교원수',
      '논문수',
      '1인당논문수',
      '전국순위',
      '권역순위',
    ])
    for (const h of headers) expect(h).toHaveAttribute('scope', 'col')
  })

  it('학교명은 행 머리(scope=row)다', () => {
    render(<CompareTable rows={[hoseo]} caption={CAPTION} />)
    expect(rowOf('호서대학교').querySelector('th')).toHaveAttribute(
      'scope',
      'row',
    )
  })

  it('가로 스크롤 영역을 키보드로 잡을 수 있다', () => {
    // 스크롤되는 영역에 포커스가 못 가면 키보드만 쓰는 사람은 표의
    // 오른쪽 절반을 볼 방법이 없다(390px 화면에서 실제로 일어난다).
    render(<CompareTable rows={[hoseo]} caption={CAPTION} />)
    expect(screen.getByRole('region')).toHaveAttribute('tabindex', '0')
  })
})

describe('CompareTable — 값 포맷', () => {
  it('한 행의 여섯 값을 규칙대로 찍는다', () => {
    render(<CompareTable rows={[soonchunhyang]} caption={CAPTION} />)
    const row = rowOf('순천향대학교')
    expect(row).toHaveTextContent('931명')
    expect(row).toHaveTextContent('368.8편')
    expect(row).toHaveTextContent('0.3961')
    expect(row).toHaveTextContent('26위')
    expect(row).toHaveTextContent('4위')
  })

  it('받은 순서를 바꾸지 않는다', () => {
    // 정렬은 서버가 1인당논문수 내림차순으로 이미 했다. 표가 다시 정렬하면
    // 두 곳의 규칙이 갈라진다.
    render(
      <CompareTable
        rows={[nazarene, soonchunhyang, hoseo]}
        caption={CAPTION}
      />,
    )
    const names = screen
      .getAllByRole('rowheader')
      .map((h) => h.textContent ?? '')
    expect(names[0]).toContain('나사렛대학교')
    expect(names[1]).toContain('순천향대학교')
    expect(names[2]).toContain('호서대학교')
  })

  it('숫자 열은 우측 정렬하고 고정폭 숫자를 쓴다', () => {
    // 자릿수가 흔들리면 세로로 훑을 때 값을 비교할 수 없다.
    render(<CompareTable rows={[soonchunhyang]} caption={CAPTION} />)
    const cell = screen.getByText('931명')
    expect(cell.className).toContain('text-right')
    expect(cell.className).toContain('tabular-nums')
    expect(cell.className).toContain('var(--font-numeric)')
  })
})

describe('CompareTable — 대상 대학 강조', () => {
  it('해당 행에 강조 표시와 스크린리더용 설명을 함께 둔다', () => {
    // 색만으로 구분하면 색을 못 보는 사람에게는 강조가 없는 것과 같다.
    render(
      <CompareTable
        rows={[soonchunhyang, hoseo]}
        caption={CAPTION}
        highlightName="호서대학교"
      />,
    )
    const row = rowOf('호서대학교')
    expect(row).toHaveAttribute('data-highlight', 'true')
    expect(row).toHaveAttribute('aria-current', 'true')
    expect(within(row).getByText('분석 대상')).toBeInTheDocument()
  })

  it('대상이 아닌 행에는 강조도 설명도 붙이지 않는다', () => {
    render(
      <CompareTable
        rows={[soonchunhyang, hoseo]}
        caption={CAPTION}
        highlightName="호서대학교"
      />,
    )
    const row = rowOf('순천향대학교')
    expect(row).not.toHaveAttribute('data-highlight')
    expect(within(row).queryByText('분석 대상')).not.toBeInTheDocument()
  })

  it('highlightName 이 없으면 아무 행도 강조하지 않는다', () => {
    const { container } = render(
      <CompareTable rows={[soonchunhyang, hoseo]} caption={CAPTION} />,
    )
    expect(container.querySelector('[data-highlight]')).toBeNull()
    expect(screen.queryByText('분석 대상')).not.toBeInTheDocument()
  })

  it('rows 에 없는 이름을 줘도 터지지 않고 아무 행도 강조하지 않는다', () => {
    // 대상 대학이 그 해 비교군에서 빠질 수 있다. 표는 그대로 그려져야 한다.
    const { container } = render(
      <CompareTable
        rows={[soonchunhyang, hoseo]}
        caption={CAPTION}
        highlightName="없는대학교"
      />,
    )
    expect(container.querySelector('[data-highlight]')).toBeNull()
    expect(screen.queryByText('분석 대상')).not.toBeInTheDocument()
    expect(screen.getAllByRole('rowheader')).toHaveLength(2)
  })

  it('부분 일치로 엉뚱한 행을 강조하지 않는다', () => {
    const { container } = render(
      <CompareTable
        rows={[hoseo]}
        caption={CAPTION}
        highlightName="호서"
      />,
    )
    expect(container.querySelector('[data-highlight]')).toBeNull()
  })
})

describe('CompareTable — 경계', () => {
  it('빈 배열이면 표 대신 안내를 낸다', () => {
    render(<CompareTable rows={[]} caption={CAPTION} />)
    expect(screen.getByText(/표시할 데이터가 없다/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('순위가 null 이면 값 없음 기호를 찍는다', () => {
    const outsider: CompareRow = {
      ...hoseo,
      name: '제주국제대학교',
      nationalRank: null,
      regionalRank: null,
    }
    render(<CompareTable rows={[outsider]} caption={CAPTION} />)
    expect(within(rowOf('제주국제대학교')).getAllByText('—')).toHaveLength(2)
  })

  it('논문수 0 은 값 없음이 아니라 0.0편이다', () => {
    // 같은 행에서 0 과 null 을 나란히 두고, 기호가 하나만 나오는지 본다.
    const zero: CompareRow = {
      name: '실적없는대학교',
      faculty: 100,
      papers: 0,
      perCapita: 0,
      nationalRank: null,
      regionalRank: 30,
    }
    render(<CompareTable rows={[zero]} caption={CAPTION} />)
    const row = rowOf('실적없는대학교')
    expect(row).toHaveTextContent('0.0편')
    expect(row).toHaveTextContent('0.0000')
    expect(row).toHaveTextContent('30위')
    expect(within(row).getAllByText('—')).toHaveLength(1)
  })

  it('긴 한글 대학명이 들어와도 그대로 그린다', () => {
    const long = '한국과학기술원부설한국정보통신대학교세종캠퍼스제2공학관'
    render(
      <CompareTable
        rows={[{ ...hoseo, name: long }]}
        caption={CAPTION}
        highlightName={long}
      />,
    )
    expect(screen.getByText(long)).toBeInTheDocument()
    expect(rowOf(long)).toHaveAttribute('data-highlight', 'true')
  })

  it('학교명에 든 HTML 을 마크업으로 해석하지 않는다', () => {
    render(
      <CompareTable rows={[{ ...hoseo, name: '<b>x</b>' }]} caption={CAPTION} />,
    )
    expect(screen.getByText('<b>x</b>')).toBeInTheDocument()
    expect(document.querySelector('table b')).toBeNull()
  })

  it('이름이 같은 행이 둘이어도 둘 다 그리고 둘 다 강조한다', () => {
    // 키 충돌로 한 행이 사라지는 사고를 막는다.
    render(
      <CompareTable
        rows={[hoseo, hoseo]}
        caption={CAPTION}
        highlightName="호서대학교"
      />,
    )
    expect(screen.getAllByRole('rowheader')).toHaveLength(2)
    expect(screen.getAllByText('분석 대상')).toHaveLength(2)
  })

  it('loading 이면 스켈레톤만 그리고 표는 그리지 않는다', () => {
    render(<CompareTable rows={[hoseo]} caption={CAPTION} loading />)
    expect(screen.getByTestId('compare-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('406명')).not.toBeInTheDocument()
  })

  it('loading 은 빈 배열보다 먼저다', () => {
    render(<CompareTable rows={[]} caption={CAPTION} loading />)
    expect(screen.getByTestId('compare-skeleton')).toBeInTheDocument()
    expect(screen.queryByText(/표시할 데이터가 없다/)).not.toBeInTheDocument()
  })
})

describe('CompareTable — 접근성', () => {
  it('axe 위반이 없다', async () => {
    // 강조 행·결측 행·스크롤 영역을 모두 포함한 상태로 검사한다.
    const { container } = render(
      <CompareTable
        rows={[
          soonchunhyang,
          hoseo,
          { ...nazarene, regionalRank: null, nationalRank: null },
        ]}
        caption={CAPTION}
        highlightName="호서대학교"
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})


// ---------------------------------------------------------------------------
// 회귀 구멍 메우기
//
// 아래 셋은 구현에 돌연변이를 주입했을 때 기존 37개가 **전부 살아남아서**
// 추가한 것이다. 구현은 옳았지만 테스트가 그것을 증명하지 못했다.
// ---------------------------------------------------------------------------

describe('CompareTable — 회귀 구멍 메우기', () => {
  it('가로 스크롤 영역에 접근 가능한 이름이 붙는다', () => {
    // 이름 없는 스크롤 영역은 스크린리더의 영역 목록에서 구분되지 않는다.
    // caption 을 필수로 만든 근거가 여기서도 지켜져야 한다.
    render(<CompareTable rows={[hoseo]} caption={CAPTION} />)
    expect(screen.getByRole('region', { name: CAPTION })).toBeInTheDocument()
  })

  it('학교명이 중복돼도 재렌더에서 행이 사라지지 않는다', () => {
    // React key 충돌은 최초 렌더가 아니라 **목록이 바뀌는 재렌더**에서
    // 행 누락으로 나타난다. 단발 렌더로는 재현되지 않는다.
    const dupA: CompareRow = { ...hoseo, name: '같은대학교', faculty: 100 }
    const dupB: CompareRow = { ...nazarene, name: '같은대학교', faculty: 200 }

    const { rerender } = render(
      <CompareTable rows={[dupA, dupB]} caption={CAPTION} />,
    )
    expect(screen.getAllByRole('rowheader', { name: /같은대학교/ })).toHaveLength(2)

    // 앞에 한 행을 끼워 인덱스를 밀어도 세 행이 모두 남아야 한다
    rerender(<CompareTable rows={[hoseo, dupA, dupB]} caption={CAPTION} />)
    expect(screen.getAllByRole('rowheader', { name: /같은대학교/ })).toHaveLength(2)
    expect(screen.getByText('100명')).toBeInTheDocument()
    expect(screen.getByText('200명')).toBeInTheDocument()
  })

  it('네 자리 논문수에도 천단위 구분자가 붙는다', () => {
    // 성균관대(1,636.36편)처럼 네 자리가 실제로 있다. 교원수로만 잠가 두면
    // 논문수 포매터의 useGrouping 을 꺼도 테스트가 전부 통과한다.
    const big: CompareRow = { ...hoseo, papers: 1636.36 }
    render(<CompareTable rows={[big]} caption={CAPTION} />)
    expect(screen.getByText('1,636.4편')).toBeInTheDocument()
  })
})
