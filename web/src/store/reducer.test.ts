import { describe, it, expect } from 'vitest'

import { INITIAL_STATE, reducer } from './reducer'
import type { WizardState } from './types'
import { NARRATIVE_KEYS } from './types'
import type { StatsResponse } from '../api/client'

/**
 * 원본 Streamlit 판에서 상태 관리로만 확정 결함 6건이 났다.
 * 그 6건을 여기서 잠근다 — 리듀서가 순수 함수라 렌더 없이 정확히 검사된다.
 */

const stats = (university: string, year: number) =>
  ({
    university,
    year,
    regionName: '충청권',
    compareGroup: [university],
    compareGroupNote: null,
    trend: {},
    averages: {},
    rankChanges: {},
    compare: [],
    yoy: { top: [], bottom: [], target: null },
  }) as unknown as StatsResponse

/** 4단계까지 진행하고 서술을 채운 상태를 만든다. */
function loadedAtStep4(): WizardState {
  let s = INITIAL_STATE
  s = reducer(s, { type: 'selectTarget', university: '호서대학교', year: 2026 })
  s = reducer(s, { type: 'loadSuccess', stats: stats('호서대학교', 2026) })
  s = reducer(s, { type: 'next' }) // 2
  s = reducer(s, { type: 'next' }) // 3
  s = reducer(s, { type: 'next' }) // 4
  for (const key of NARRATIVE_KEYS) {
    s = reducer(s, { type: 'setNarrative', key, text: `${key} 서술` })
  }
  return s
}

describe('리듀서 — 기본', () => {
  it('알 수 없는 액션에 같은 객체를 돌려준다', () => {
    // 참조가 같아야 리렌더가 일어나지 않는다
    const unknown = { type: 'nope' } as unknown as Parameters<typeof reducer>[1]
    expect(reducer(INITIAL_STATE, unknown)).toBe(INITIAL_STATE)
  })

  it('상태를 제자리에서 바꾸지 않는다', () => {
    const before = INITIAL_STATE
    const snapshot = JSON.stringify(before)
    reducer(before, { type: 'next' })
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('단계 이동 (V06 · V19)', () => {
  it('next 는 도달 범위를 한 칸 넓힌다', () => {
    const s = reducer(INITIAL_STATE, { type: 'next' })
    expect(s.step).toBe(2)
    expect(s.maxStep).toBe(2)
  })

  it('뒤로 가도 maxStep 은 줄지 않는다', () => {
    let s = reducer(INITIAL_STATE, { type: 'next' })
    s = reducer(s, { type: 'next' })
    expect(s.maxStep).toBe(3)

    s = reducer(s, { type: 'goto', step: 1 })
    expect(s.step).toBe(1)
    expect(s.maxStep).toBe(3) // V19 가 났던 지점
  })

  it('도달하지 않은 단계로는 건너뛸 수 없다', () => {
    // V06: 리셋 후에도 2~5단계가 클릭 가능해 크래시가 났다
    const s = reducer(INITIAL_STATE, { type: 'goto', step: 4 })
    expect(s.step).toBe(1)
    expect(s).toBe(INITIAL_STATE) // 무시했으면 새 객체를 만들지 않는다
  })

  it('5단계에서 next 를 눌러도 넘어가지 않는다', () => {
    let s = INITIAL_STATE
    for (let i = 0; i < 10; i += 1) s = reducer(s, { type: 'next' })
    expect(s.step).toBe(5)
    expect(s.maxStep).toBe(5)
  })

  it('goto 는 범위 밖 값을 받아도 상태를 망가뜨리지 않는다', () => {
    const s = reducer(INITIAL_STATE, { type: 'goto', step: 0 as never })
    expect(s.step).toBe(1)
  })
})

describe('서술 보존 (V07)', () => {
  it('단계를 왕복해도 서술 4개가 남는다', () => {
    // 4 → 5 → 4. Streamlit 은 여기서 위젯 상태가 사라져 빈 문자열이 덮어썼다.
    let s = loadedAtStep4()
    s = reducer(s, { type: 'next' }) // 5
    s = reducer(s, { type: 'goto', step: 4 })

    for (const key of NARRATIVE_KEYS) {
      expect(s.narratives[key], `${key} 가 사라졌다`).toBe(`${key} 서술`)
    }
  })

  it('4 → 3 → 4 왕복에서도 남는다', () => {
    let s = loadedAtStep4()
    s = reducer(s, { type: 'goto', step: 3 })
    s = reducer(s, { type: 'goto', step: 4 })
    expect(s.narratives.trend).toBe('trend 서술')
  })

  it('1단계까지 갔다 와도 남는다', () => {
    let s = loadedAtStep4()
    s = reducer(s, { type: 'goto', step: 1 })
    s = reducer(s, { type: 'goto', step: 4 })
    expect(Object.values(s.narratives).every((v) => v !== '')).toBe(true)
  })

  it('사용자가 의도적으로 비운 서술을 되살리지 않는다', () => {
    // "빈 값이면 백업하지 않는다" 는 단축은 쓰지 않는다.
    let s = loadedAtStep4()
    s = reducer(s, { type: 'setNarrative', key: 'trend', text: '' })
    s = reducer(s, { type: 'goto', step: 5 })
    s = reducer(s, { type: 'goto', step: 4 })
    expect(s.narratives.trend).toBe('')
  })
})

describe('리셋 (V04 · V05 · V06)', () => {
  it('리셋은 초기 상태와 완전히 같다', () => {
    // 키를 골라 지우지 않는다 — 고르는 순간 빠뜨린다.
    const s = reducer(loadedAtStep4(), { type: 'reset' })
    expect(s).toEqual(INITIAL_STATE)
  })

  it('리셋이 maxStep 을 1 로 되돌린다', () => {
    // V06: Streamlit 리셋은 max_step 을 건드리지 않아 잠긴 단계가 열려 있었다
    const s = reducer(loadedAtStep4(), { type: 'reset' })
    expect(s.maxStep).toBe(1)
    expect(s.step).toBe(1)
  })

  it('리셋이 서술과 통계를 모두 지운다', () => {
    const s = reducer(loadedAtStep4(), { type: 'reset' })
    expect(s.stats).toBeNull()
    expect(Object.values(s.narratives).every((v) => v === '')).toBe(true)
    expect(s.university).toBeNull()
  })

  it('리셋 후 도달하지 않은 단계로 갈 수 없다', () => {
    // V06 의 실제 증상: 리셋 후 사이드바로 2단계에 가면 TypeError 가 났다
    let s = reducer(loadedAtStep4(), { type: 'reset' })
    s = reducer(s, { type: 'goto', step: 3 })
    expect(s.step).toBe(1)
  })

  it('리셋을 두 번 해도 같다', () => {
    const once = reducer(loadedAtStep4(), { type: 'reset' })
    const twice = reducer(once, { type: 'reset' })
    expect(twice).toEqual(once)
  })
})

describe('재로드 시 파생 상태 정리 (V17)', () => {
  it('대상을 바꾸면 이전 통계와 서술이 사라진다', () => {
    // V17: A 를 보다 B 를 불러오면 필터에 A 원본, 3단계에 A 차트가 남았다
    let s = loadedAtStep4()
    s = reducer(s, { type: 'selectTarget', university: '순천향대학교', year: 2026 })

    expect(s.stats).toBeNull()
    expect(Object.values(s.narratives).every((v) => v === '')).toBe(true)
    expect(s.university).toBe('순천향대학교')
  })

  it('대상을 바꾸면 1단계로 돌아가고 도달 범위도 좁아진다', () => {
    // 남은 도달 범위로 3단계에 가면 지워진 통계를 그리려다 터진다
    let s = loadedAtStep4()
    s = reducer(s, { type: 'selectTarget', university: '순천향대학교', year: 2026 })
    expect(s.step).toBe(1)
    expect(s.maxStep).toBe(1)
  })

  it('같은 대상을 다시 골라도 파생 상태를 지운다', () => {
    // "같으니까 유지" 는 서버 데이터가 갱신된 경우를 놓친다
    let s = loadedAtStep4()
    s = reducer(s, { type: 'selectTarget', university: '호서대학교', year: 2026 })
    expect(s.stats).toBeNull()
  })

  it('연도만 바꿔도 파생 상태를 지운다', () => {
    let s = loadedAtStep4()
    s = reducer(s, { type: 'selectTarget', university: '호서대학교', year: 2025 })
    expect(s.stats).toBeNull()
    expect(s.year).toBe(2025)
  })
})

describe('로딩과 오류', () => {
  it('loadStart 는 이전 오류를 지운다', () => {
    let s = reducer(INITIAL_STATE, { type: 'loadFailure', error: '앞선 실패' })
    s = reducer(s, { type: 'loadStart' })
    expect(s.loading).toBe(true)
    expect(s.error).toBeNull()
  })

  it('loadSuccess 는 서버가 확정한 권역을 받아 적는다', () => {
    // 권역은 클라이언트가 추측하지 않는다(V03)
    const s = reducer(INITIAL_STATE, {
      type: 'loadSuccess',
      stats: stats('호서대학교', 2026),
    })
    expect(s.regionName).toBe('충청권')
    expect(s.loading).toBe(false)
  })

  it('loadFailure 는 이전 통계를 남기지 않는다', () => {
    // 실패했는데 옛 숫자가 화면에 남아 있으면 성공한 것처럼 보인다
    let s = loadedAtStep4()
    s = reducer(s, { type: 'loadFailure', error: '서버 오류' })
    expect(s.stats).toBeNull()
    expect(s.error).toBe('서버 오류')
    expect(s.loading).toBe(false)
  })
})
