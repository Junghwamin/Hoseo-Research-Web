import { useSyncExternalStore } from 'react'

import type { DatasetOverlay, DatasetPreviewResponse, OverlayRegionalRow, OverlayRow } from './client'

/**
 * 브라우저 데이터셋(overlay) — 공개 사이트에서 "새 데이터를 더하는" 유일한 길.
 *
 * Vercel 의 디스크는 읽기 전용이고 인스턴스마다 다르다. 그래서 **서버는 계산만 하고
 * 상태는 브라우저가 든다.** `/api/dataset/preview` 가 돌려준 한 해의 행들을 여기
 * 저장해 두고, `api/client.ts` 가 이후 모든 요청 본문에 `overlay` 로 실어 보낸다.
 * 서버는 요청마다 기본 데이터에 덧씌워 계산하고 아무것도 남기지 않는다.
 *
 * 저장소는 `localStorage` 다. 못 쓰는 브라우저(사생활 모드·회사 정책)에서는 메모리에만
 * 산다 — 새로고침하면 사라지지만 앱은 죽지 않는다. 저장소 접근은 전부 try/catch 다.
 *
 * 같은 해를 다시 더하면 **바꿔치기**한다(정정 파일). 표에 같은 해가 두 줄 보이면 순위가
 * 전부 틀린다 — 그 상태는 어떤 경로로도 만들지 않는다.
 */

export const OVERLAY_STORAGE_KEY = 'hoseo-dataset-overlay'

/** 직렬화 상한. 넘기면 저장소가 조용히 거절해 "저장됐는데 새로고침하면 없다" 가 된다. */
export const OVERLAY_MAX_BYTES = 2 * 1024 * 1024

export const OVERLAY_TOO_LARGE = '추가한 데이터가 2MB 를 넘습니다. 연도를 줄여서 다시 올리세요.'

export interface OverlayItem {
  readonly year: number
  /** 그 해 전국 표의 대학 수. 패널 목록에 "{n}개교" 로 보인다. */
  readonly universities: number
  readonly sourceFile: string
  /** ISO 시각. `overlayKey()` 가 같은 해의 재업로드를 구분하는 데 쓴다. */
  readonly addedAt: string
}

export interface OverlayState {
  readonly items: readonly OverlayItem[]
  readonly national: readonly OverlayRow[]
  readonly regional: readonly OverlayRegionalRow[]
}

interface Persisted {
  readonly v: 1
  readonly items: OverlayItem[]
  readonly national: OverlayRow[]
  readonly regional: OverlayRegionalRow[]
}

let state: OverlayState | null | undefined
const listeners = new Set<() => void>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 저장된 JSON 이 우리가 쓴 모양인지. 아니면(손상·옛 버전) 버린다 — 고칠 수 있는 게 없다. */
function parse(raw: string | null): OverlayState | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data) || data.v !== 1) return null
    const { items, national, regional } = data as Partial<Persisted>
    if (!Array.isArray(items) || !Array.isArray(national) || !Array.isArray(regional)) return null
    if (items.length === 0) return null
    return { items, national, regional }
  } catch {
    return null
  }
}

function read(): OverlayState | null {
  try {
    return parse(localStorage.getItem(OVERLAY_STORAGE_KEY))
  } catch {
    return null
  }
}

function serialize(next: OverlayState): string {
  const payload: Persisted = {
    v: 1,
    items: [...next.items],
    national: [...next.national],
    regional: [...next.regional],
  }
  return JSON.stringify(payload)
}

function byteLength(text: string): number {
  try {
    return new TextEncoder().encode(text).length
  } catch {
    return text.length
  }
}

function write(next: OverlayState | null, json: string | null): void {
  state = next
  try {
    if (json === null) localStorage.removeItem(OVERLAY_STORAGE_KEY)
    else localStorage.setItem(OVERLAY_STORAGE_KEY, json)
  } catch {
    /* 저장소를 못 쓴다. 메모리 값으로 이번 세션은 동작한다. */
  }
  for (const listener of listeners) listener()
}

function current(): OverlayState | null {
  if (state === undefined) state = read()
  return state
}

/** 지금 들고 있는 추가 데이터. 없으면 null. */
export function getOverlay(): OverlayState | null {
  return current()
}

/** 요청 본문에 실을 모양. 없으면 null — 그러면 `api/client.ts` 가 GET 경로를 쓴다. */
export function overlayPayload(): DatasetOverlay | null {
  const now = current()
  if (!now || now.items.length === 0) return null
  return { national: [...now.national], regional: [...now.regional] }
}

/**
 * 추가 데이터의 정체성. 차트 캐시 키와 리마운트 키에 쓴다.
 *
 * 같은 해를 다시 올리면 `addedAt` 이 바뀌어 키가 달라진다 — 그래야 옛 그림이 남지 않는다.
 */
export function overlayKey(): string | null {
  const now = current()
  if (!now || now.items.length === 0) return null
  return now.items.map((item) => `${item.year}@${item.addedAt}`).join('|')
}

/**
 * 한 해를 더한다. 같은 해가 있으면 **바꿔치기**한다.
 *
 * 상한을 넘으면 아무것도 바꾸지 않고 던진다 — 반쯤 저장된 상태를 남기지 않는다.
 */
export function addOverlayYear(preview: DatasetPreviewResponse, addedAt: string): void {
  const now = current()
  const year = preview.year
  const items = [
    ...(now?.items ?? []).filter((item) => item.year !== year),
    { year, universities: preview.universities, sourceFile: preview.sourceFile, addedAt },
  ].sort((a, b) => a.year - b.year)
  const next: OverlayState = {
    items,
    national: [...(now?.national ?? []).filter((r) => r.year !== year), ...preview.national],
    regional: [...(now?.regional ?? []).filter((r) => r.year !== year), ...preview.regional],
  }
  const json = serialize(next)
  if (byteLength(json) > OVERLAY_MAX_BYTES) throw new Error(OVERLAY_TOO_LARGE)
  write(next, json)
}

/** 한 해를 뺀다. 마지막 해를 빼면 저장소에서도 지운다. */
export function removeOverlayYear(year: number): void {
  const now = current()
  if (!now) return
  const items = now.items.filter((item) => item.year !== year)
  if (items.length === 0) {
    write(null, null)
    return
  }
  const next: OverlayState = {
    items,
    national: now.national.filter((r) => r.year !== year),
    regional: now.regional.filter((r) => r.year !== year),
  }
  write(next, serialize(next))
}

export function clearOverlay(): void {
  write(null, null)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 컴포넌트에서 추가 데이터를 구독한다. 더하고 빼는 즉시 다시 그린다. */
export function useOverlay(): OverlayState | null {
  return useSyncExternalStore(subscribe, current, () => null)
}
