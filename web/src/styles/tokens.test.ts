import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

/**
 * 계획 §12-1·§12-2 를 테스트로 강제한다.
 *
 * Streamlit 판에서 `styles.py` 가 829줄까지 자란 이유는 색·간격 값이 파일마다
 * 흩어져서였다. 규칙을 문서에만 두면 또 흩어진다.
 */

// Windows 에서 URL.pathname 은 '/C:/...' 를 돌려준다. fileURLToPath 를 써야 한다.
const SRC = dirname(dirname(fileURLToPath(import.meta.url)))
const TOKENS = join(SRC, 'styles', 'tokens.css')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      out.push(...walk(p))
    } else if (['.ts', '.tsx'].includes(extname(name))) {
      out.push(p)
    }
  }
  return out
}

/** 검사 대상: 테스트·스토리·토큰 정의 자체는 제외한다. */
function componentSources(): string[] {
  return walk(SRC).filter(
    (p) =>
      !p.includes('.test.') &&
      !p.includes('.stories.') &&
      !p.includes(`${join('src', 'test')}`) &&
      !p.endsWith('tokens.css'),
  )
}

describe('디자인 토큰 — 단일 소스 규칙', () => {
  it('컴포넌트 소스에 hex 색상 리터럴이 없다', () => {
    const offenders: string[] = []
    for (const file of componentSources()) {
      const src = readFileSync(file, 'utf8')
      src.split('\n').forEach((line, i) => {
        // #fff / #ffffff / #ffffffff 형태
        if (/#[0-9a-fA-F]{3,8}\b/.test(line)) {
          offenders.push(`${file.replace(SRC, '')}:${i + 1}  ${line.trim()}`)
        }
      })
    }
    expect(offenders, [
      'hex 색상은 tokens.css 에만 둔다. 컴포넌트는 var(--...) 를 쓴다.',
      ...offenders,
    ].join('\n')).toEqual([])
  })

  it('컴포넌트 소스에 rgb()/hsl() 리터럴이 없다', () => {
    const offenders: string[] = []
    for (const file of componentSources()) {
      const src = readFileSync(file, 'utf8')
      src.split('\n').forEach((line, i) => {
        if (/\b(rgba?|hsla?)\s*\(/.test(line)) {
          offenders.push(`${file.replace(SRC, '')}:${i + 1}  ${line.trim()}`)
        }
      })
    }
    expect(offenders.join('\n')).toBe('')
  })

  it('컴포넌트가 인라인 <style> 을 만들지 않는다', () => {
    // D09(gpt_section 인라인 CSS 7개가 전역 CSS 와 충돌)의 재발 방지
    const offenders = componentSources().filter((file) =>
      /<style[\s>]|dangerouslySetInnerHTML/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders.map((p) => p.replace(SRC, ''))).toEqual([])
  })
})

describe('디자인 토큰 — 테마 대칭성', () => {
  const css = readFileSync(TOKENS, 'utf8')

  function varsIn(blockStart: string): Set<string> {
    const i = css.indexOf(blockStart)
    expect(i, `${blockStart} 블록을 찾지 못했다`).toBeGreaterThan(-1)
    const open = css.indexOf('{', i)
    // 중첩 없는 단순 블록이라 첫 '}' 까지면 충분하다
    const close = css.indexOf('}', open)
    const body = css.slice(open, close)
    return new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
  }

  it('다크 테마가 라이트의 표면·텍스트 토큰을 빠짐없이 재정의한다', () => {
    const light = varsIn(':root {')
    const dark = varsIn(":root[data-theme='dark']")

    // 브랜드 팔레트(@theme)는 테마 무관이므로 :root 의 의미 토큰만 본다
    const missing = [...light].filter((v) => !dark.has(v))
    expect(missing, `다크에서 빠진 토큰: ${missing.join(', ')}`).toEqual([])
  })

  it('다크 테마에 순수 검정을 쓰지 않는다', () => {
    const i = css.indexOf(":root[data-theme='dark']")
    const body = css.slice(i, css.indexOf('}', css.indexOf('{', i)))
    expect(body).not.toMatch(/#000\b|#000000\b/)
  })

  it('증감 의미색이 라이트·다크 양쪽에 정의돼 있다', () => {
    // V09 가 났던 축이다. 한쪽 테마에서만 정의되면 다른 쪽이 상속으로 새어나간다.
    for (const name of ['--color-up', '--color-down']) {
      const occurrences = css.split(`${name}:`).length - 1
      expect(occurrences, `${name} 정의 횟수`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('디자인 토큰 — 모션 접근성', () => {
  it('prefers-reduced-motion 을 존중한다', () => {
    const css = readFileSync(TOKENS, 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
