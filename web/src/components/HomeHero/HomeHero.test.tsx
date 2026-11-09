import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'

import type { DatasetInfo } from '../../api/client'
import { HomeHero } from './HomeHero'

/**
 * 활자 히어로 + 「자료 현황」 패널.
 *
 * 사진·3D 가 없으므로 "장식이 실패해도 글은 남는다" 는 걱정이 사라졌다. 대신
 * **숫자를 지어내지 않는다** 는 계약이 생겼다 — 패널의 대학 수·연도·권역 수와
 * 범위 문장은 전부 `/api/data` 에서 온다. 서버 문장은 여기서 직접 만든다:
 * `stats.fixture` 의 문구에 기대면 그쪽이 바뀔 때 이 테스트가 이유 없이 깨진다.
 */

const SCOPE_NOTE =
  '전국순위는 대학알리미에 등재된 사립 133개교 기준입니다. 국공립대·과기원은 집계에 포함되지 않습니다.'

const dataset: DatasetInfo = {
  years: [2016, 2017, 2026],
  regions: ['충청권'],
  universities: ['호서대학교'],
  universityCount: 133,
  nationalRankScopeNote: SCOPE_NOTE,
  overlayYears: [],
}

function setup(props: Partial<React.ComponentProps<typeof HomeHero>> = {}) {
  const onStart = vi.fn()
  const onRetry = vi.fn()
  const utils = render(
    <HomeHero dataset={dataset} onStart={onStart} onRetry={onRetry} {...props} />,
  )
  return { ...utils, onStart, onRetry }
}

describe('HomeHero', () => {
  it('표제와 부제를 보여준다', () => {
    setup()
    expect(
      screen.getByRole('heading', { level: 1, name: '우리 대학은 몇 번째인가' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/1인당 SCI급·SCOPUS 논문 수/)).toBeInTheDocument()
  })

  it('h1 의 접근성 이름은 강조 span 과 무관하게 「우리 대학은 몇 번째인가」다', () => {
    // "몇 번째" 만 주홍으로 칠하려고 span 을 끼운다. 그 span 이 이름을 쪼개거나
    // 띄어쓰기를 먹으면 e2e(`heading, { name }`)와 낭독기가 다른 제목을 듣는다.
    setup()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveAccessibleName('우리 대학은 몇 번째인가')
    expect(within(h1).getByText('몇 번째').className).toMatch(/var\(--accent\)/)
  })

  it('자료 현황 패널이 서버의 범위 문장을 그대로 보여준다', () => {
    setup()
    const panel = screen.getByTestId('data-panel')
    expect(within(panel).getByText(SCOPE_NOTE)).toBeInTheDocument()
    // 숫자도 전부 응답에서 온다 — 대학 수, 최신 공시 연도.
    expect(within(panel).getByText('133')).toBeInTheDocument()
    expect(within(panel).getByText('2026')).toBeInTheDocument()
  })

  it('자료 범위 띠는 출처·공시 연도·갱신 주기 세 항목이다', () => {
    setup()
    const list = screen.getByRole('list', { name: '자료 범위' })
    expect(within(list).getByText('출처 대학알리미 「7-가. 전임교원의 연구 실적」')).toBeInTheDocument()
    // 연도 범위는 dataset.years 의 양끝이다. 상수가 아니다.
    expect(within(list).getByText('공시 2016–2026년')).toBeInTheDocument()
    expect(within(list).getByText('매년 8월 공시 반영')).toBeInTheDocument()
  })

  it('데이터가 아직 없으면 숫자 항목을 비워 두지 않고 생략한다', () => {
    setup({ dataset: null })
    expect(document.body.textContent).not.toMatch(/undefined|NaN|Infinity|–년|개교 기준/)
    // 글은 데이터 없이도 그대로다 — 콜드 스타트 중 첫 화면이 빈 종이가 되지 않는다.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/대학알리미 「7-가/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '분석 시작' })).toBeInTheDocument()
    expect(screen.getByTestId('data-panel')).toBeInTheDocument()
  })

  it('불러오지 못하면 패널 안에서 이유를 말하고 다시 시도할 수 있다', async () => {
    const { onRetry } = setup({ dataset: null, datasetError: '서버가 요청을 처리하지 못했습니다(503).' })
    const panel = screen.getByTestId('data-panel')
    expect(within(panel).getByRole('alert')).toHaveTextContent('서버가 요청을 처리하지 못했습니다(503).')
    await userEvent.click(within(panel).getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    // 히어로의 글은 오류와 무관하게 남는다.
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('분석 시작을 누르면 onStart 가 불린다', async () => {
    const { onStart } = setup()
    await userEvent.click(screen.getByRole('button', { name: '분석 시작' }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('장식 레이어는 보조 기술에서 감춘다', () => {
    setup()
    expect(screen.getByTestId('hero-static')).toHaveAttribute('aria-hidden', 'true')
  })

  it('사진·캔버스가 없다', () => {
    setup()
    expect(document.querySelector('img, canvas')).toBeNull()
  })

  it('서버 문장을 마크업으로 해석하지 않는다', () => {
    setup({ dataset: { ...dataset, nationalRankScopeNote: '<b>굵게</b>' } })
    expect(screen.getByText('<b>굵게</b>')).toBeInTheDocument()
    expect(document.querySelector('b')).toBeNull()
  })

  it('세리프 글꼴 별칭을 쓰지 않는다 — 표제도 Pretendard 700 이다', () => {
    setup()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.className).not.toMatch(/font-serif/)
    expect(h1.className).toMatch(/\bfont-bold\b/)
  })

  it('axe 위반이 없다', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})
