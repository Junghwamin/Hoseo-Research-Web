/**
 * 번들 크기 예산 가드.
 *
 * 설치본은 오프라인이라 CDN 으로 덜어낼 수 없다 — 번들에 들어간 것은 전부
 * 사용자 디스크로 간다. recharts 를 넣으면서 gzip 70KB → 178KB 로 뛰었는데,
 * 이런 증가가 눈에 띄지 않으면 계속 쌓인다.
 *
 * 예산을 넘으면 빌드를 실패시킨다. 정당한 증가라면 예산을 **의식적으로** 올린다.
 */

import { readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist')

/** gzip 기준 KB. 3D 히어로(Phase 6)가 들어오면 다시 협상한다. */
const BUDGET = {
  '.js': 200,
  '.css': 20,
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

let failed = false
const totals = {}

for (const file of walk(DIST)) {
  const ext = extname(file)
  if (!(ext in BUDGET)) continue
  const gz = gzipSync(readFileSync(file)).length / 1024
  totals[ext] = (totals[ext] ?? 0) + gz
}

console.log('번들 크기 (gzip)')
for (const [ext, kb] of Object.entries(totals)) {
  const limit = BUDGET[ext]
  const ok = kb <= limit
  if (!ok) failed = true
  console.log(
    `  ${ext.padEnd(5)} ${kb.toFixed(1).padStart(7)} KB / ${String(limit).padStart(4)} KB  ${ok ? 'OK' : '예산 초과'}`,
  )
}

if (failed) {
  console.error(
    '\n번들이 예산을 넘었다. 무엇이 늘었는지 확인하고, 정당하면 ' +
      'web/scripts/check-bundle.mjs 의 BUDGET 을 의식적으로 올려라.',
  )
  process.exit(1)
}
