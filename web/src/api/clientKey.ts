import { useSyncExternalStore } from 'react'

/**
 * 브라우저가 든 OpenAI 키(BYOK).
 *
 * 공개 사이트에는 키를 저장할 서버 디스크가 없고, 운영자 키 하나를 전원이 쓰게 둘 수도
 * 없다(인증이 없는 엔드포인트다). 그래서 **키는 이 브라우저에만 저장되고**, 서술을
 * 만들 때만 `X-OpenAI-Key` 헤더로 서버를 거쳐 OpenAI 로 간다. 서버는 요청이 끝나면
 * 잊는다 — 응답·로그 어디에도 남기지 않는다(`api/routers/report.py`).
 *
 * `localStorage` 를 못 쓰는 브라우저에서는 메모리에만 산다. 저장소 접근은 전부 try/catch.
 */

export const CLIENT_KEY_STORAGE_KEY = 'hoseo-openai-key'

const MIN_LENGTH = 20
const MAX_LENGTH = 200

let key: string | null | undefined
const listeners = new Set<() => void>()

function read(): string | null {
  try {
    const raw = localStorage.getItem(CLIENT_KEY_STORAGE_KEY)
    return raw && raw.trim() ? raw.trim() : null
  } catch {
    return null
  }
}

function current(): string | null {
  if (key === undefined) key = read()
  return key
}

function write(next: string | null): void {
  key = next
  try {
    if (next === null) localStorage.removeItem(CLIENT_KEY_STORAGE_KEY)
    else localStorage.setItem(CLIENT_KEY_STORAGE_KEY, next)
  } catch {
    /* 저장소를 못 쓴다. 메모리 값으로 이번 세션은 동작한다. */
  }
  for (const listener of listeners) listener()
}

/** 저장된 키. 없으면 null. 요청 헤더를 붙일 때 `api/client.ts` 가 읽는다. */
export function getClientKey(): string | null {
  return current()
}

export function setClientKey(next: string): void {
  write(next.trim())
}

export function clearClientKey(): void {
  write(null)
}

/** 화면에 보일 모양. 앞 5자 + … + 뒤 4자. 가운데를 보여주면 마스킹이 아니다. */
export function maskKey(value: string): string {
  if (value.length <= 10) return 'sk-…'
  return `${value.slice(0, 5)}…${value.slice(-4)}`
}

/**
 * 보내기 전에 거르는 형식 검사. 오류 문구 또는 null.
 *
 * 서버도 같은 규칙(`^sk-[\x21-\x7e]{17,197}$`)으로 막지만, 올린 뒤에 듣는 것보다 고를 때
 * 아는 편이 낫다 — 그리고 틀린 키를 OpenAI 까지 보내지 않는다.
 */
export function validateKeyFormat(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('sk-')) return 'sk- 로 시작해야 합니다'
  if (/[^\x21-\x7e]/.test(trimmed)) return '공백이나 한글이 섞여 있습니다'
  if (trimmed.length < MIN_LENGTH) return '키가 너무 짧습니다'
  if (trimmed.length > MAX_LENGTH) return '키가 너무 깁니다'
  return null
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 컴포넌트에서 키 유무를 구독한다. 저장·삭제 즉시 다시 그린다. */
export function useClientKey(): string | null {
  return useSyncExternalStore(subscribe, current, () => null)
}
