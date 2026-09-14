import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'hoseo-theme'

/**
 * 사용자가 고른 테마를 읽는다. 저장된 값이 없거나 깨졌으면 'system'.
 *
 * localStorage 접근이 예외를 던질 수 있다(사생활 보호 모드, 차단된 사이트
 * 데이터). 테마 때문에 앱이 죽으면 안 되므로 전부 흡수한다.
 */
function readStoredChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* 저장소를 못 읽으면 기본값으로 간다 */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light'
  return choice
}

/**
 * 테마 상태.
 *
 * `data-theme` 을 `<html>` 에 찍는 것이 유일한 적용 경로다(tokens.css 가
 * 그 속성으로 토큰 세트를 교체한다). 컴포넌트가 색을 직접 분기하지 않는다.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readStoredChoice)
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark)

  // OS 설정이 바뀌면 'system' 선택자에게 즉시 반영한다
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveTheme(choice, prefersDark)

  useEffect(() => {
    const root = document.documentElement
    if (choice === 'system') {
      // 속성을 지우면 tokens.css 의 prefers-color-scheme 미디어 쿼리가 맡는다
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', choice)
    }
  }, [choice])

  const setTheme = useCallback((next: ThemeChoice) => {
    setChoice(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* 저장 실패해도 이번 세션에는 적용된다 */
    }
  }, [])

  return { choice, resolved, setTheme }
}
