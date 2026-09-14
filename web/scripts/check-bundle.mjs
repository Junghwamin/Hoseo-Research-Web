/**
 * 번들 크기 예산 가드.
 *
 * 설치본은 오프라인이라 CDN 으로 덜어낼 수 없다 — 번들에 들어간 것은 전부
 * 사용자 디스크로 간다. 이런 증가가 눈에 띄지 않으면 계속 쌓인다.
 *
 * **초기 번들과 지연 청크를 따로 센다.** 둘의 성격이 다르기 때문이다.
 * index.html 이 직접 참조하는 것은 첫 화면이 뜨기 전에 반드시 받아야 하고,
 * `import()` 로 갈라진 청크는 그 기능을 실제로 쓸 때만 받는다. 3D 히어로
 * (three.js 132KB) 를 초기 번들과 같은 저울에 올리면, 정작 지켜야 할
 * "첫 화면이 얼마나 빨리 뜨는가" 를 못 보게 된다.
 *
 * 예산을 넘으면 빌드를 실패시킨다. 정당한 증가라면 예산을 **의식적으로** 올린다.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const DIST = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist')

/** gzip 기준 KB. */
const BUDGET = {
  /** 첫 화면까지 반드시 받아야 하는 것. 여기가 사용자 체감을 정한다. */
  initialJs: 200,
  initialCss: 20,
  /** 필요할 때만 받는 것. 디스크는 차지하지만 첫 화면을 늦추지 않는다. */
  lazyJs: 200,
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const gzipKb = (file) => gzipSync(readFileSync(file)).length / 1024

// index.html 이 직접 참조하는 자산 = 초기 번들
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const referenced = new Set(
  [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+)"/g)].map((m) => m[1]),
)

const buckets = { initialJs: [], initialCss: [], lazyJs: [] }

for (const file of walk(DIST)) {
  const ext = extname(file)
  if (ext !== '.js' && ext !== '.css') continue
  const rel = file.slice(DIST.length + 1).replace(/\\/g, '/')
  const isInitial = referenced.has(rel)
  const key = ext === '.css' ? 'initialCss' : isInitial ? 'initialJs' : 'lazyJs'
  buckets[key].push({ rel, kb: gzipKb(file) })
}

const LABEL = {
  initialJs: '초기 JS  ',
  initialCss: '초기 CSS ',
  lazyJs: '지연 JS  ',
}

let failed = false
console.log('번들 크기 (gzip)')

for (const key of ['initialJs', 'initialCss', 'lazyJs']) {
  const files = buckets[key]
  const total = files.reduce((sum, f) => sum + f.kb, 0)
  const limit = BUDGET[key]
  const ok = total <= limit
  if (!ok) failed = true
  console.log(
    `  ${LABEL[key]} ${total.toFixed(1).padStart(7)} KB / ${String(limit).padStart(4)} KB  ` +
      `${ok ? 'OK' : '예산 초과'}${files.length > 1 ? `  (${files.length}개)` : ''}`,
  )
  // 지연 청크는 무엇이 들어갔는지 보여준다 — 실수로 갈라진 것을 알아채려면 필요하다
  if (key === 'lazyJs') {
    for (const f of files) console.log(`      ${f.rel}  ${f.kb.toFixed(1)} KB`)
  }
}

if (failed) {
  console.error(
    '\n번들이 예산을 넘었다. 무엇이 늘었는지 확인하고, 정당하면 ' +
      'web/scripts/check-bundle.mjs 의 BUDGET 을 의식적으로 올려라.',
  )
  process.exit(1)
}
