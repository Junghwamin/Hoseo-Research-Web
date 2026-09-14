import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

/**
 * 구조 규칙을 테스트로 강제한다.
 *
 * 목표는 하나다 — **폴더 하나가 독립 단위여야 한다.** 그래야 컴포넌트를
 * 추가하거나 고칠 때 옆 폴더를 읽지 않아도 된다.
 *
 * 규칙을 문서에만 두면 지켜지지 않는다. Streamlit 판의 `styles.py` 가
 * 829줄까지 자란 것도 "값은 한 곳에" 가 문서에만 있었기 때문이다.
 */

const SRC = dirname(fileURLToPath(import.meta.url))
const COMPONENTS = join(SRC, 'components')

function dirs(base: string): string[] {
  if (!existsSync(base)) return []
  return readdirSync(base).filter((n) => statSync(join(base, n)).isDirectory())
}

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sources(p))
    else if (['.ts', '.tsx'].includes(extname(name))) out.push(p)
  }
  return out
}

/** 검사 대상: 테스트·스토리는 자기 폴더 안을 마음껏 봐도 된다. */
function appSources(): string[] {
  return sources(SRC).filter((p) => !p.includes('.test.') && !p.includes('.stories.'))
}

describe('컴포넌트 독립성', () => {
  it('모든 컴포넌트 폴더에 공개 면(index.ts)이 있다', () => {
    const missing = dirs(COMPONENTS).filter(
      (name) => !existsSync(join(COMPONENTS, name, 'index.ts')),
    )
    expect(
      missing,
      `index.ts 가 없는 폴더: ${missing.join(', ')}\n` +
        '바깥에서 내부 파일을 직접 가리키게 되고, 파일을 쪼개는 순간 호출부가 깨진다.',
    ).toEqual([])
  })

  it('다른 폴더의 내부 파일을 직접 가리키지 않는다', () => {
    // 허용: '../Combobox'(배럴). 금지: '../Combobox/filter'(내부 파일).
    const offenders: string[] = []
    for (const file of appSources()) {
      const here = dirname(file)
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/from '((?:\.\.\/)+)(components|design)\/([\w-]+)\/([\w-]+)'/g)) {
        const [, , area, folder, inner] = m
        // design/ui 는 폴더 자체가 공개 면이라 design/ui/Button 은 내부 경로다
        const isBarrelPath = area === 'design' && folder === 'ui' && inner === 'index'
        if (isBarrelPath) continue
        offenders.push(`${relative(SRC, file)} → ${m[0]}`)
      }
      void here
    }
    expect(
      offenders,
      ['배럴(index.ts)을 통해서만 가져온다:', ...offenders].join('\n'),
    ).toEqual([])
  })

  it('컴포넌트가 화면 조립(features)을 거꾸로 가져오지 않는다', () => {
    // 의존은 한 방향이다: features → components → design.
    // 거꾸로 붙는 순간 컴포넌트를 다른 화면에 재사용할 수 없게 된다.
    const offenders = sources(COMPONENTS)
      .filter((p) => /from '.*\/features\//.test(readFileSync(p, 'utf8')))
      .map((p) => relative(SRC, p))
    expect(offenders).toEqual([])
  })

  it('디자인 시스템이 도메인을 모른다', () => {
    // design/ 은 어느 앱에 붙여도 돌아가야 한다. 여기에 '대학'·'권역'이
    // 들어오는 순간 재사용할 수 없는 컴포넌트가 된다.
    const offenders: string[] = []
    for (const file of sources(join(SRC, 'design'))) {
      if (file.includes('.test.')) continue
      const src = readFileSync(file, 'utf8')
      if (/from '.*\/(api|store|features)\//.test(src)) {
        offenders.push(relative(SRC, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('three.js 는 배럴로 새어나오지 않는다', () => {
    // 배럴이 scene 을 내보내면, 3D 를 쓰지 않는 화면의 초기 번들에도
    // three.js 가 딸려 들어간다. 지연 로딩 계약이 조용히 깨진다.
    const barrel = readFileSync(join(COMPONENTS, 'HomeHero', 'index.ts'), 'utf8')
    expect(barrel).not.toMatch(/from '\.\/scene'/)
  })
})

describe('마법사 단계', () => {
  it('단계 컴포넌트가 서로를 모른다', () => {
    // 옆 단계를 직접 부르기 시작하면 순서를 바꿀 수 없게 된다.
    const stepsDir = join(SRC, 'features', 'wizard', 'steps')
    const offenders: string[] = []
    for (const file of sources(stepsDir)) {
      if (file.includes('.test.') || /registry\.ts$/.test(file)) continue
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/from '\.\/(Step\d\w+)'/g)) {
        offenders.push(`${relative(SRC, file)} → ${m[1]}`)
      }
    }
    expect(
      offenders,
      ['단계끼리 직접 참조한다:', ...offenders].join('\n'),
    ).toEqual([])
  })

  it('단계를 늘리려면 registry 한 곳만 고치면 된다', async () => {
    // 진행 표시·이동 버튼·잠금 규칙이 전부 이 배열에서 파생되는지 확인한다.
    const { STEP_REGISTRY } = await import('./features/wizard/steps/registry')
    const { STEPS } = await import('./store/types')

    expect(STEP_REGISTRY).toHaveLength(STEPS.length)
    STEP_REGISTRY.forEach((step, i) => {
      expect(step.id, `${i} 번째 항목의 id`).toBe(i + 1)
      expect(step.title).toBe(STEPS[i])
      expect(typeof step.Component).toBe('function')
    })
  })
})
