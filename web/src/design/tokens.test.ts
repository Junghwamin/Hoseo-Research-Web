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
const DESIGN = dirname(fileURLToPath(import.meta.url))
const SRC = dirname(DESIGN)
const TOKENS = join(DESIGN, 'tokens.css')

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

  it('OS 다크(prefers-color-scheme) 블록이 명시 다크와 같은 토큰을 정의한다', () => {
    // 다크 토큰 블록이 둘인 것은 CSS 의 제약이다 — 선택자 목록에 @media 를
    // 넣을 수 없다. 둘이 어긋나면 **테마를 고르지 않은 시스템 다크 사용자만**
    // 조용히 깨진다. 아무도 눈치채지 못하는 종류의 회귀라 테스트로 막는다.
    const chosen = varsIn(":root[data-theme='dark']")
    const system = varsIn(":root:not([data-theme='light'])")

    const missing = [...chosen].filter((v) => !system.has(v))
    const extra = [...system].filter((v) => !chosen.has(v))
    expect(
      { missing, extra },
      'prefers-color-scheme 블록과 [data-theme=dark] 블록의 토큰이 어긋난다',
    ).toEqual({ missing: [], extra: [] })
  })

  it('두 다크 블록의 토큰 값까지 같다', () => {
    // 이름만 맞고 값이 다르면 더 찾기 어렵다 — 같은 화면이 경로에 따라
    // 다른 색으로 보인다.
    function valuesIn(blockStart: string): Map<string, string> {
      const i = css.indexOf(blockStart)
      const open = css.indexOf('{', i)
      const body = css.slice(open, css.indexOf('}', open))
      return new Map(
        // 값에 줄바꿈이 들어갈 수 있다(여러 줄 gradient). 들여쓰기 차이는
        // 드리프트가 아니므로 공백을 접어서 비교한다.
        [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
          m[1],
          m[2].replace(/\s+/g, ' ').trim(),
        ]),
      )
    }
    const chosen = valuesIn(":root[data-theme='dark']")
    const system = valuesIn(":root:not([data-theme='light'])")
    const differing = [...chosen].filter(([k, v]) => system.get(k) !== v)
    expect(Object.fromEntries(differing.map(([k, v]) => [k, `${v} vs ${system.get(k)}`]))).toEqual(
      {},
    )
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

describe('디자인 토큰 — 정합성', () => {
  const css = readFileSync(TOKENS, 'utf8')

  it('소스가 참조하는 var(--x) 는 tokens.css 에 선언돼 있다', () => {
    // 선언되지 않은 토큰을 참조하면 브라우저는 조용히 무시한다 — 글꼴이
    // 폴백으로 떨어져도 아무 경고가 없다. `--font-numeric` 이 그렇게 넉 달을 갔다.
    const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const offenders: string[] = []
    for (const file of componentSources()) {
      const src = readFileSync(file, 'utf8')
      src.split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/var\((--[\w-]+)[,)]/g)) {
          if (!declared.has(m[1])) {
            offenders.push(`${file.replace(SRC, '')}:${i + 1}  ${m[1]}`)
          }
        }
      })
    }
    expect(offenders, ['tokens.css 에 없는 토큰을 참조한다.', ...offenders].join('\n')).toEqual([])
  })

  it('body 에 overflow-wrap: anywhere 가 없다', () => {
    // 390px 에서 표 머리글과 상단바 글자가 한 자씩 쪼개진 원인. 한글은
    // keep-all 만으로 충분하고, 넘치는 표는 가로 스크롤 영역이 맡는다.
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('새 타입 토큰 8개가 @theme 에 있다', () => {
    for (const name of ['display', 'title', 'heading', 'lead', 'body', 'meta', 'kpi', 'kpi-sub']) {
      expect(css, `--text-${name}`).toMatch(new RegExp(`--text-${name}:`))
    }
  })

  it('모서리 토큰이 전부 0px 이다 — tom-modern 의 실루엣', () => {
    // 알약 버튼·둥근 칩·둥근 카드가 전부 직각이 된다. 컴포넌트는 토큰만
    // 참조하므로 값 하나로 실루엣이 정해진다(DESIGN.md §5).
    for (const name of ['sm', 'md', 'lg', 'xl', 'full']) {
      expect(css, `--radius-${name}`).toMatch(new RegExp(`--radius-${name}:\\s*0px;`))
    }
  })

  it('아이브로·격자·그림자 토큰이 있다', () => {
    for (const t of [
      '--text-eyebrow',
      '--surface-alt',
      '--accent-text',
      '--shadow-soft',
      '--shadow-hard',
      '--grid-line',
      '--grid-size',
    ]) {
      expect(css, t).toMatch(new RegExp(`${t}:`))
    }
  })

  it('eyebrow·eyebrow-mono·tabular 유틸리티가 선언돼 있다', () => {
    // 구획 라벨·단계 번호·표 머리글이 전부 이 셋을 쓴다. 컴포넌트가 크기·자간을
    // 손으로 적기 시작하면 아이브로가 파일마다 조금씩 달라진다.
    for (const name of ['eyebrow', 'eyebrow-mono', 'tabular']) {
      expect(css, `@utility ${name}`).toMatch(new RegExp(`@utility ${name} \\{`))
    }
  })

  it('숫자 글꼴은 Geist Mono 스택이다', () => {
    // 모노는 숫자·연도·순위·코드에만 건다. 한글이 섞인 문장에는 걸지 않는다 —
    // 서브셋에 한글이 없어 글꼴이 갈라진다(DESIGN.md §3).
    expect(css).toMatch(/--font-mono:\s*'Geist Mono'/)
    expect(css).toMatch(/--font-numeric:\s*var\(--font-mono\)/)
  })

  it('body 에 30px 격자가 깔린다', () => {
    expect(css).toMatch(/background-size:\s*var\(--grid-size\)\s+var\(--grid-size\)/)
  })

  // --- WCAG 대비 ----------------------------------------------------------
  function blockValue(blockStart: string, name: string): string {
    const i = css.indexOf(blockStart)
    expect(i, `${blockStart} 블록`).toBeGreaterThan(-1)
    const open = css.indexOf('{', i)
    const body = css.slice(open, css.indexOf('}', open))
    const m = body.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`))
    expect(m, `${name} 는 ${blockStart} 에 6자리 hex 로 있어야 대비를 계산할 수 있다`).not.toBeNull()
    return m![1]
  }
  function luminance(hex: string): number {
    const channel = (i: number) => {
      const s = parseInt(hex.slice(i, i + 2), 16) / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  }
  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  it('라이트 --text-muted 는 흰 바탕과 sunken 바탕에서 4.5:1 이상이다', () => {
    // 12px 캡션이 전부 이 색이다. 감사 시점 값(#7a7a7a)은 4.29:1 로 AA 미달이었다.
    const muted = blockValue(':root {', '--text-muted')
    expect(contrast(muted, blockValue(':root {', '--surface-raised'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(muted, blockValue(':root {', '--surface-sunken'))).toBeGreaterThanOrEqual(4.5)
  })

  it('다크 --text-muted 는 바탕에서 4.5:1 이상이다', () => {
    const dark = ":root[data-theme='dark']"
    expect(
      contrast(blockValue(dark, '--text-muted'), blockValue(dark, '--surface-base')),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('라이트 --accent 는 흰 바탕에서 3:1 이상(큰 글자), --accent-text 는 4.5:1 이상', () => {
    // 주홍 하나가 면·선·≥24px 700 글자를 맡고, 18px 미만 글자는 어둡게 깎은
    // --accent-text 가 맡는다. 둘을 하나로 합치면 작은 링크가 AA 에 미달한다.
    const raised = blockValue(':root {', '--surface-raised')
    expect(contrast(blockValue(':root {', '--accent'), raised)).toBeGreaterThanOrEqual(3)
    expect(contrast(blockValue(':root {', '--accent-text'), raised)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('디자인 토큰 — 타입 스케일은 토큰 8개만', () => {
  function offendersMatching(pattern: RegExp): string[] {
    const out: string[] = []
    for (const file of componentSources()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (pattern.test(line)) out.push(`${file.replace(SRC, '')}:${i + 1}  ${line.trim()}`)
        })
    }
    return out
  }

  it('컴포넌트가 Tailwind 기본 글자 크기를 직접 쓰지 않는다', () => {
    // 크기가 토큰 밖에서 늘어나면 위계가 사라진다. 12/14/16 은 text-meta/body/lead 다.
    const offenders = offendersMatching(/\btext-(xs|sm|base|lg|[2-9]xl)\b/)
    expect(offenders, ['토큰 유틸리티(text-meta/body/lead/heading/…)를 쓴다.', ...offenders].join('\n')).toEqual([])
  })

  it('800 이상 굵기를 쓰지 않는다 — Pretendard Variable 은 700 까지 번들됐다', () => {
    // 가변 글꼴이라 700 은 합성 볼드가 아니다. 표제 둘(h1·h2)과 KPI 숫자만 700 을
    // 쓴다. 800 이상은 번들에 없으므로 브라우저가 굵기를 흉내 낸다(합성 볼드).
    const offenders = offendersMatching(/\bfont-(extrabold|black)\b/)
    expect(offenders.join('\n')).toBe('')
  })
})

describe('디자인 토큰 — 모션 접근성', () => {
  it('prefers-reduced-motion 을 존중한다', () => {
    const css = readFileSync(TOKENS, 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})

describe('디자인 토큰 — 걷어낸 것', () => {
  const css = readFileSync(TOKENS, 'utf8')

  it('삭제 예정 별칭(--font-serif, --shadow-lg)이 없다', () => {
    // 세리프 표제와 블러 그림자는 tom-modern 적용으로 사라졌다. 별칭을 남겨 두면
    // 새 코드가 옛 이름을 다시 집어 든다.
    expect(css).not.toMatch(/--font-serif\s*:/)
    expect(css).not.toMatch(/--shadow-lg\s*:/)
  })

  it('소스에 Hahmlet·font-serif·shadow-lg 참조가 없다', () => {
    const offenders: string[] = []
    for (const file of componentSources()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/Hahmlet|--font-serif|--shadow-lg/.test(line)) {
            offenders.push(`${file.replace(SRC, '')}:${i + 1}  ${line.trim()}`)
          }
        })
    }
    expect(offenders, ['걷어낸 글꼴·그림자를 다시 참조한다.', ...offenders].join('\n')).toEqual([])
  })
})
