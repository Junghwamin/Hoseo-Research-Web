import { useEffect, useRef, useState } from 'react'

import { api, chartUrl, type ChartKind } from '../../api/client'

/**
 * 차트 주소를 정하는 입력. `chartUrl` 의 두 번째 인자와 **같은 타입**이다 —
 * GET 주소와 POST 본문이 같은 입력에서 나와야 화면과 Word 가 갈라지지 않는다.
 */
export type ChartParams = Parameters<typeof chartUrl>[1]

export type ChartImageStatus = 'loading' | 'ready' | 'error'

export interface ChartImage {
  /** `<img src>` 에 넣을 주소. POST 경로에서 아직 받는 중이면 `null`. */
  readonly src: string | null
  readonly status: ChartImageStatus
  /** 실패한 그림만 다시 받는다. GET 경로에서는 주소를 바꿔 브라우저의 실패 캐시를 피한다. */
  readonly retry: () => void
}

/**
 * POST 경로의 그림 한 장. `api.chartBlob` 이 추가 데이터(overlay)를 본문에 싣는다 —
 * 그래서 이 경로의 그림은 브라우저가 든 데이터까지 반영된 것이고, Word 와 같다.
 */
const chartBlob = (kind: ChartKind, params: ChartParams): Promise<Blob> => api.chartBlob(kind, params)

/**
 * 그려 둔 그림 한 장. `url` 은 받기 전까지 `null`, 받은 뒤에는 objectURL 이다.
 * `stale` 은 받는 도중에 overlay 가 바뀐 경우 — 도착한 그림을 쓰지 않고 바로 버린다.
 */
interface Entry {
  promise: Promise<string>
  url: string | null
  stale: boolean
}

/**
 * 모듈 수준 캐시. 키 = 종류 + 입력 전부 + overlayKey.
 *
 * 단계를 오갈 때마다 matplotlib 이 다시 돌지 않게 하려는 것이다 — GET 경로는
 * 브라우저 캐시가 그 일을 하지만 POST 는 캐시를 타지 않는다. Promise 를 넣어 두는
 * 이유는 같은 키가 동시에 둘 마운트돼도 요청이 한 번만 나가게 하기 위해서다.
 */
const CACHE = new Map<string, Entry>()

/** 마지막으로 본 overlay 키. 바뀌면 그려 둔 그림을 전부 버린다(아래 useEffect). */
let lastOverlayKey: string | null | undefined

/**
 * 캐시 키. `JSON.stringify(params)` 가 아니라 **순서를 고정한 튜플**이다 — 호출부가
 * 넘기는 객체의 키 순서가 달라져도 같은 그림은 같은 키여야 한다.
 */
export function chartImageKey(kind: ChartKind, params: ChartParams, overlayKey: string): string {
  return JSON.stringify([
    kind,
    params.university,
    params.year,
    params.region ?? null,
    params.compareGroup ?? null,
    params.years ?? null,
    params.dataVersion ?? null,
    overlayKey,
  ])
}

function load(kind: ChartKind, params: ChartParams, key: string): Promise<string> {
  const hit = CACHE.get(key)
  if (hit) return hit.promise

  const entry: Entry = { promise: Promise.resolve(''), url: null, stale: false }
  entry.promise = chartBlob(kind, params).then(
    (blob) => {
      const url = URL.createObjectURL(blob)
      if (entry.stale) {
        // 받는 사이 overlay 가 바뀌었다. 옛 데이터로 그린 그림이다 — 쓰지 않는다.
        URL.revokeObjectURL(url)
        throw new Error('overlay 가 바뀌어 버린 그림')
      }
      entry.url = url
      return url
    },
    (error: unknown) => {
      // 실패는 캐시에 남기지 않는다. 남기면 「다시 그리기」가 영원히 같은 실패를 돌려준다.
      if (CACHE.get(key) === entry) CACHE.delete(key)
      throw error
    },
  )
  CACHE.set(key, entry)
  return entry.promise
}

/**
 * 그려 둔 그림을 전부 버린다 — objectURL 을 전부 revoke 하고 캐시를 비운다.
 *
 * overlay 가 바뀌면 반드시 불린다(아래 훅이 키 변화를 보고 스스로 부르고, 바깥에서도
 * 부를 수 있다). 옛 그림이 캐시에 남으면 화면과 Word 가 갈라진다 — 화면은 옛
 * 데이터, 문서는 새 데이터로 만들어진다.
 */
export function revokeChartImages(): void {
  for (const entry of CACHE.values()) {
    if (entry.url !== null) URL.revokeObjectURL(entry.url)
    else entry.stale = true
  }
  CACHE.clear()
}

interface Result {
  key: string
  attempt: number
  src: string | null
  status: ChartImageStatus
}

/**
 * 서버 차트 한 장의 주소.
 *
 * - `overlayKey` 가 없으면(기본 데이터만) **GET 주소**를 그대로 돌려준다. 요청은
 *   `<img src>` 가 하고 브라우저 캐시가 재사용을 맡는다 — 지금까지의 경로 그대로다.
 * - `overlayKey` 가 있으면 브라우저가 든 추가 데이터를 본문에 실어야 하므로 **POST** 로
 *   받아 objectURL 을 만든다. 같은 키는 모듈 캐시에서 다시 쓰고, overlay 가 바뀌면
 *   전부 버린다(`revokeChartImages`).
 *
 * 상태는 「받았는가」 까지다. 받은 뒤 `<img>` 가 실제로 그려졌는지는 호출부가
 * onLoad/onError 로 본다.
 */
export function useChartImage(
  kind: ChartKind,
  params: ChartParams,
  overlayKey: string | null,
): ChartImage {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = overlayKey === null ? null : chartImageKey(kind, params, overlayKey)

  // 요청에 쓸 최신 입력. key 가 kind·params 를 전부 담고 있어 아래 효과의 의존성은
  // key 로 충분하다 — params 객체를 그대로 의존성에 넣으면 호출부가 렌더마다 새
  // 객체를 만들어 끝없이 다시 받는다. 효과 순서상 이 갱신이 먼저 돈다.
  const latest = useRef({ kind, params })
  useEffect(() => {
    latest.current = { kind, params }
  })

  useEffect(() => {
    // overlay 가 바뀌면 그려 둔 그림을 전부 버린다. 같은 갤러리의 다른 칸은 같은
    // 키를 보므로 첫 칸 하나만 비우고 나머지는 지나간다.
    if (overlayKey !== lastOverlayKey) {
      lastOverlayKey = overlayKey
      revokeChartImages()
    }
    if (key === null) return

    let cancelled = false
    const request = latest.current
    load(request.kind, request.params, key).then(
      (src) => {
        if (!cancelled) setResult({ key, attempt, src, status: 'ready' })
      },
      () => {
        if (!cancelled) setResult({ key, attempt, src: null, status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, overlayKey, attempt])

  function retry() {
    if (key !== null) {
      const entry = CACHE.get(key)
      if (entry) {
        if (entry.url !== null) URL.revokeObjectURL(entry.url)
        else entry.stale = true
        CACHE.delete(key)
      }
    }
    setAttempt((n) => n + 1)
  }

  if (key === null) {
    // GET 경로. 다시 그리기는 주소를 바꾼다 — 같은 주소를 다시 넣으면 브라우저가
    // 실패를 캐시해 두고 재요청하지 않는다. 서버는 `r` 을 읽지 않는다.
    const base = chartUrl(kind, params)
    return { src: attempt > 0 ? `${base}&r=${attempt}` : base, status: 'ready', retry }
  }

  // 이미 받아 둔 그림은 효과를 기다리지 않고 바로 쓴다 — 단계를 오갈 때 깜빡이지 않는다.
  // retry 가 항목을 지우므로, 여기 있는 그림은 언제나 지금 attempt 의 것이다.
  const cachedUrl = CACHE.get(key)?.url
  if (cachedUrl != null) {
    return { src: cachedUrl, status: 'ready', retry }
  }

  const current = result !== null && result.key === key && result.attempt === attempt ? result : null
  return { src: current?.src ?? null, status: current?.status ?? 'loading', retry }
}
