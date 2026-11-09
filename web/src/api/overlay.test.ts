import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DatasetPreviewResponse } from './client'
import {
  OVERLAY_MAX_BYTES,
  OVERLAY_STORAGE_KEY,
  addOverlayYear,
  clearOverlay,
  getOverlay,
  overlayKey,
  overlayPayload,
  removeOverlayYear,
  useOverlay,
} from './overlay'

/**
 * 브라우저 데이터셋 저장소의 계약.
 *
 * 공개 사이트에서 새 데이터를 더하는 유일한 길이다. 가장 중요한 것은 둘 —
 * **같은 해는 바꿔치기한다**(표에 같은 해가 두 줄이면 순위가 전부 틀린다),
 * **저장소를 못 써도 앱은 돈다**(사생활 모드·회사 정책).
 */

function preview(year: number, n = 2): DatasetPreviewResponse {
  const national = Array.from({ length: n }, (_, i) => ({
    year,
    name: `대학${i}`,
    faculty: 100 + i,
    papers: 20 + i,
    perCapita: 0.2 + i / 100,
    nationalRank: i + 1,
  }))
  return {
    year,
    universities: n,
    sourceFile: `${year}년_자료.xlsx`,
    national,
    regional: national.map((r) => ({ ...r, regionName: '충청권', regionalRank: r.nationalRank })),
  }
}

beforeEach(() => {
  localStorage.clear()
  clearOverlay()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('overlay 저장소', () => {
  it('처음에는 비어 있고 요청에 실을 것도 없다', () => {
    expect(getOverlay()).toBeNull()
    expect(overlayPayload()).toBeNull()
    expect(overlayKey()).toBeNull()
  })

  it('한 해를 더하면 목록·행·키가 생기고 저장소에 남는다', () => {
    addOverlayYear(preview(2027), '2026-11-09T00:00:00.000Z')

    const now = getOverlay()!
    expect(now.items).toEqual([
      { year: 2027, universities: 2, sourceFile: '2027년_자료.xlsx', addedAt: '2026-11-09T00:00:00.000Z' },
    ])
    expect(now.national).toHaveLength(2)
    expect(overlayPayload()).toEqual({ national: now.national, regional: now.regional })
    expect(overlayKey()).toBe('2027@2026-11-09T00:00:00.000Z')

    const stored = JSON.parse(localStorage.getItem(OVERLAY_STORAGE_KEY)!)
    expect(stored.v).toBe(1)
    expect(stored.items).toHaveLength(1)
  })

  it('같은 해를 다시 더하면 바꿔치기한다 — 두 줄이 되지 않는다', () => {
    addOverlayYear(preview(2027, 2), 'a')
    addOverlayYear(preview(2027, 3), 'b')

    const now = getOverlay()!
    expect(now.items).toHaveLength(1)
    expect(now.items[0]).toMatchObject({ year: 2027, universities: 3, addedAt: 'b' })
    expect(now.national).toHaveLength(3)
    expect(now.regional).toHaveLength(3)
    expect(overlayKey()).toBe('2027@b')
  })

  it('여러 해는 연도순으로 정렬된다', () => {
    addOverlayYear(preview(2028), 'x')
    addOverlayYear(preview(2027), 'y')
    expect(getOverlay()!.items.map((i) => i.year)).toEqual([2027, 2028])
    expect(overlayKey()).toBe('2027@y|2028@x')
  })

  it('한 해를 빼면 그 해의 행만 사라지고, 마지막 해를 빼면 저장소에서도 지운다', () => {
    addOverlayYear(preview(2027), 'a')
    addOverlayYear(preview(2028), 'b')

    removeOverlayYear(2027)
    expect(getOverlay()!.items.map((i) => i.year)).toEqual([2028])
    expect(getOverlay()!.national.every((r) => r.year === 2028)).toBe(true)

    removeOverlayYear(2028)
    expect(getOverlay()).toBeNull()
    expect(localStorage.getItem(OVERLAY_STORAGE_KEY)).toBeNull()
  })

  it('모두 지우기', () => {
    addOverlayYear(preview(2027), 'a')
    clearOverlay()
    expect(getOverlay()).toBeNull()
    expect(overlayPayload()).toBeNull()
    expect(localStorage.getItem(OVERLAY_STORAGE_KEY)).toBeNull()
  })

  it('새로고침(모듈 재로드) 뒤에도 저장소에서 복원한다', async () => {
    addOverlayYear(preview(2027), 'a')
    vi.resetModules()
    const fresh = await import('./overlay')
    expect(fresh.getOverlay()!.items[0]!.year).toBe(2027)
    fresh.clearOverlay()
  })

  it('상한을 넘는 추가는 거절하고 아무것도 바꾸지 않는다', () => {
    addOverlayYear(preview(2027), 'a')
    const huge = preview(2028, 1)
    const padded = {
      ...huge,
      national: [{ ...huge.national[0]!, name: 'x'.repeat(OVERLAY_MAX_BYTES) }],
    }

    expect(() => addOverlayYear(padded, 'b')).toThrow(/2MB/)
    expect(getOverlay()!.items.map((i) => i.year)).toEqual([2027])
  })

  it('손상된 JSON 이나 낯선 버전은 버린다', async () => {
    localStorage.setItem(OVERLAY_STORAGE_KEY, '{not json')
    vi.resetModules()
    let fresh = await import('./overlay')
    expect(fresh.getOverlay()).toBeNull()

    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify({ v: 99, items: [{ year: 2027 }] }))
    vi.resetModules()
    fresh = await import('./overlay')
    expect(fresh.getOverlay()).toBeNull()
  })

  it('저장소가 예외를 던져도 메모리에서 동작한다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => addOverlayYear(preview(2027), 'a')).not.toThrow()
    expect(getOverlay()!.items[0]!.year).toBe(2027)
    expect(overlayPayload()).not.toBeNull()

    expect(() => clearOverlay()).not.toThrow()
    expect(getOverlay()).toBeNull()
  })

  it('useOverlay 는 더하고 빼는 즉시 다시 그린다', () => {
    const { result } = renderHook(() => useOverlay())
    expect(result.current).toBeNull()

    act(() => addOverlayYear(preview(2027), 'a'))
    expect(result.current!.items[0]!.year).toBe(2027)

    act(() => removeOverlayYear(2027))
    expect(result.current).toBeNull()
  })
})
