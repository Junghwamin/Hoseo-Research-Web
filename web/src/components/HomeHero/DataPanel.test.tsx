import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'

import type { DatasetInfo } from '../../api/client'
import { DataPanel } from './DataPanel'

/**
 * 「자료 현황」 — 이 제품만의 한 조각(설계 §4). 템플릿에는 없고, 쓰는 사람만
 * 넣을 수 있는 것이다. 그래서 계약도 하나뿐이다: **여기 적힌 숫자는 전부
 * `/api/data` 응답이다.** 상수로 박힌 대학 수·연도는 8월 공시가 바뀌는 순간
 * 거짓이 된다.
 */

const SCOPE_NOTE =
  '전국순위는 대학알리미에 등재된 사립 133개교 기준입니다. 국공립대·과기원은 집계에 포함되지 않습니다.'

function makeDataset(overrides: Partial<DatasetInfo> = {}): DatasetInfo {
  // Partial 을 펼치면 overlayYears 가 `number[] | undefined` 로 넓어진다. 테스트
  // 픽스처라 단언으로 되돌린다 — 호출부는 정의된 값만 넘긴다.
  return {
    years: [2016, 2017, 2018, 2026],
    regions: ['충청권', '수도권', '호남권'],
    universities: ['호서대학교', '단국대학교'],
    universityCount: 133,
    nationalRankScopeNote: SCOPE_NOTE,
    overlayYears: [],
    ...overrides,
  } as DatasetInfo
}

describe('DataPanel', () => {
  it('자료 현황 숫자는 전부 dataset 에서 온다', () => {
    render(<DataPanel dataset={makeDataset()} />)
    const panel = screen.getByTestId('data-panel')

    // 개교 · 개년 · 권역 · 최신 공시 — 각 숫자는 바로 옆 라벨과 짝이다.
    expect(within(panel).getByText('133').nextElementSibling).toHaveTextContent('개교')
    expect(within(panel).getByText('4').nextElementSibling).toHaveTextContent('개년')
    expect(within(panel).getByText('3').nextElementSibling).toHaveTextContent('권역')
    expect(within(panel).getByText('2026').nextElementSibling).toHaveTextContent('최신 공시')
    // 서버 문장은 글자 그대로 — 고치지도, 마크업으로 해석하지도 않는다.
    expect(within(panel).getByText(SCOPE_NOTE)).toBeInTheDocument()
  })

  it('숫자는 Geist Mono 로 그린다 — 한글 라벨은 아니다', () => {
    // 모노 서브셋에는 한글이 없다. 라벨까지 걸면 글꼴이 폴백으로 갈라진다(DESIGN.md §3).
    render(<DataPanel dataset={makeDataset()} />)
    const panel = screen.getByTestId('data-panel')
    expect(within(panel).getByText('133').className).toMatch(/var\(--font-numeric\)/)
    expect(within(panel).getByText('개교').className).not.toMatch(/font-numeric/)
  })

  it('추가 데이터가 있으면 그 해를 말한다', () => {
    // 브라우저에만 더한 해를 패널이 밝히지 않으면 사용자는 공시 자료와 자기
    // 파일을 구분할 수 없다(설계 §8).
    render(<DataPanel dataset={makeDataset({ overlayYears: [2027, 2028] })} />)
    expect(screen.getByTestId('overlay-note')).toHaveTextContent('추가 데이터 2027·2028년 · 이 브라우저')
  })

  it('추가 데이터가 없으면 그 줄 자체가 없다', () => {
    render(<DataPanel dataset={makeDataset()} />)
    expect(screen.queryByTestId('overlay-note')).toBeNull()
    expect(screen.getByTestId('data-panel')).not.toHaveTextContent('추가 데이터')
  })

  it('연도가 비어 있어도 지어낸 숫자를 보이지 않는다', () => {
    // Math.max() 의 -Infinity 가 화면에 찍힌 적이 있는 종류의 사고다.
    render(<DataPanel dataset={makeDataset({ years: [] })} />)
    expect(screen.getByTestId('data-panel').textContent).not.toMatch(/Infinity|NaN|undefined/)
  })

  it('실패하면 이유와 「다시 시도」를 보인다 — role=alert, status 는 아니다', async () => {
    // 콤보박스의 status 가 페이지의 첫 role=status 로 남아야 하는 e2e 계약이 있다.
    const onRetry = vi.fn()
    render(<DataPanel dataset={null} error="서버가 요청을 처리하지 못했습니다(503)." onRetry={onRetry} />)
    const panel = screen.getByTestId('data-panel')

    expect(within(panel).getByRole('alert')).toHaveTextContent(
      '자료 현황을 불러오지 못했습니다. 서버가 요청을 처리하지 못했습니다(503).',
    )
    expect(within(panel).queryByRole('status')).toBeNull()
    await userEvent.click(within(panel).getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('axe 위반이 없다', async () => {
    const { container } = render(<DataPanel dataset={makeDataset()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('DataPanel — 아직 없을 때', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('200ms 뒤에 스켈레톤을 그리고 status 는 만들지 않는다', () => {
    render(<DataPanel dataset={null} />)
    const panel = screen.getByTestId('data-panel')

    // 패널의 틀과 제목은 바로 서고, 숫자 자리만 늦게 채워진다.
    expect(within(panel).getByText('자료 현황')).toBeInTheDocument()
    expect(panel.querySelector('[aria-busy="true"]')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(panel.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(panel.querySelector('[role="status"]')).toBeNull()
    expect(panel.textContent).not.toMatch(/undefined|NaN|Infinity/)
  })
})
