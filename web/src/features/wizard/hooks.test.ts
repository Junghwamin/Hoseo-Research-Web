import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDataset } from './hooks'

const DATASET = {
  years: [2026],
  regions: [],
  universities: [],
  universityCount: 1,
  nationalRankScopeNote: '',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useDataset', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('실패한 뒤 reload() 가 같은 요청을 다시 보낸다', async () => {
    // Vercel 콜드 스타트 중 첫 요청이 504 로 죽으면 화면이 "불러오지 못했다" 에서
    // 멈췄다. 새로고침 말고 다시 시도할 길이 있어야 한다.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('upstream timeout', { status: 504 }))
      .mockResolvedValueOnce(jsonResponse(DATASET))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDataset())
    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.data).toBeNull()

    act(() => result.current.reload())

    await waitFor(() => expect(result.current.data).toEqual(DATASET))
    expect(result.current.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('/api/data')
  })
})
