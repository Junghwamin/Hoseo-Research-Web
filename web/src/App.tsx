import { useEffect, useState } from 'react'

import { api, ApiError, byYear, type DatasetInfo, type StatsResponse } from './api/client'
import { CompareTable } from './components/CompareTable/CompareTable'
import { MetricCard } from './components/MetricCard/MetricCard'
import type { DeltaDirection } from './components/MetricCard/types'
import { TrendChart } from './components/TrendChart/TrendChart'
import { YoYPanel } from './components/YoYPanel/YoYPanel'
import { FEATURES } from './features'
import { useTheme } from './theme/useTheme'

/**
 * Phase 4 확인용 화면.
 *
 * 실제 5단계 마법사는 Phase 5 에서 붙인다. 여기서는 **API 에 붙은 컴포넌트가
 * 진짜 데이터로 그려지는지** 를 본다 — 하드코딩 더미로는 계약이 맞는지 알 수 없다.
 */
const MODULES = [
  { key: 'research', label: '연구실적', icon: '📊' },
  { key: 'educationCost', label: '교육비환원율', icon: '📈' },
  { key: 'employment', label: '취업률', icon: '💼' },
] as const

const TARGET = '호서대학교'

/** 순위 변화를 방향으로 해석한다. **순위는 작아지는 것이 개선**이고, API 의
 * `*RankDelta` 는 이미 "양수 = 개선" 으로 계산돼 온다(V09). 여기서 다시
 * 뒤집지 않는다. */
function rankDirection(delta: number | null | undefined): DeltaDirection {
  if (delta === null || delta === undefined || delta === 0) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

function rankLabel(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '비교 없음'
  if (delta === 0) return '변동 없음'
  return `${delta > 0 ? '+' : ''}${delta}계단`
}

export default function App() {
  const { choice, setTheme } = useTheme()
  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const info = await api.dataset()
        if (!alive) return
        setDataset(info)

        const latest = info.years[info.years.length - 1]
        const s = await api.stats({ university: TARGET, year: latest })
        if (!alive) return
        setStats(s)
      } catch (e) {
        if (!alive) return
        setError(e instanceof ApiError ? e.detail : String(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const visible = MODULES.filter((m) => FEATURES[m.key])
  const loading = !stats && !error

  const year = stats?.year
  const point = year ? stats.trend[String(year)] : undefined
  const rank = year ? stats.rankChanges[String(year)] : undefined

  const trendSeries = stats
    ? [
        {
          name: stats.university,
          emphasis: true,
          points: byYear(stats.trend).map((r) => ({ year: r.year, value: r.perCapita })),
        },
        {
          name: `${stats.regionName} 평균`,
          points: byYear(stats.averages).map((r) => ({ year: r.year, value: r.regional ?? null })),
        },
        {
          name: '전국 평균',
          points: byYear(stats.averages).map((r) => ({ year: r.year, value: r.national ?? null })),
        },
      ]
    : []

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-[var(--spacing-6)] p-[var(--spacing-6)]">
      <header className="flex flex-wrap items-center justify-between gap-[var(--spacing-4)]">
        <div>
          <h1 className="m-0 text-2xl font-bold text-[var(--text-primary)]">
            연구실적 분석 포털
          </h1>
          {stats && (
            <p className="mt-[var(--spacing-1)] text-sm text-[var(--text-secondary)]">
              {stats.university} · {stats.regionName} · {stats.year}년
            </p>
          )}
        </div>

        <div className="flex gap-[var(--spacing-2)]" role="group" aria-label="테마 선택">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              aria-pressed={choice === t}
              className="
                rounded-[var(--radius-md)] border border-[var(--border-subtle)]
                bg-[var(--surface-raised)] px-[var(--spacing-3)] py-[var(--spacing-2)]
                text-sm text-[var(--text-secondary)]
                transition-colors duration-[var(--duration-fast)]
                hover:border-[var(--border-strong)]
                aria-pressed:border-[var(--accent)]
                aria-pressed:bg-[var(--accent-soft)]
                aria-pressed:text-[var(--accent)]
              "
            >
              {t === 'light' ? '라이트' : t === 'dark' ? '다크' : '시스템'}
            </button>
          ))}
        </div>
      </header>

      <nav aria-label="분석 모듈">
        <ul className="flex list-none flex-wrap gap-[var(--spacing-3)] p-0">
          {visible.map((m) => (
            <li key={m.key}>
              <span
                data-testid={`module-${m.key}`}
                className="
                  inline-flex items-center gap-[var(--spacing-2)]
                  rounded-[var(--radius-md)] border border-[var(--border-subtle)]
                  bg-[var(--surface-raised)] px-[var(--spacing-4)] py-[var(--spacing-2)]
                  text-sm font-medium text-[var(--text-primary)]
                "
              >
                <span aria-hidden="true">{m.icon}</span>
                {m.label}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {error && (
        <div
          role="alert"
          data-testid="api-error"
          className="
            rounded-[var(--radius-md)] border border-[var(--color-down)]
            bg-[var(--color-down-soft)] p-[var(--spacing-4)]
            text-sm text-[var(--color-down)]
          "
        >
          데이터를 불러오지 못했다: {error}
        </div>
      )}

      <section
        aria-label="주요 지표"
        className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-[var(--spacing-4)]"
      >
        <MetricCard
          label="전국순위"
          value={point?.nationalRank != null ? `${point.nationalRank}위` : null}
          caption={dataset ? `${year}년 · 등재 사립 ${dataset.universityCount}개교` : undefined}
          loading={loading}
          delta={
            rank
              ? {
                  label: rankLabel(rank.nationalRankDelta),
                  direction: rankDirection(rank.nationalRankDelta),
                  srLabel: `전국순위 ${rankLabel(rank.nationalRankDelta)}`,
                }
              : undefined
          }
        />
        <MetricCard
          label="권역순위"
          value={point?.regionalRank != null ? `${point.regionalRank}위` : null}
          caption={stats ? `${stats.regionName}` : undefined}
          loading={loading}
          delta={
            rank
              ? {
                  label: rankLabel(rank.regionalRankDelta),
                  direction: rankDirection(rank.regionalRankDelta),
                  srLabel: `권역순위 ${rankLabel(rank.regionalRankDelta)}`,
                }
              : undefined
          }
        />
        <MetricCard
          label="1인당논문수"
          value={point ? `${point.perCapita.toFixed(4)}편` : null}
          caption={`${year}년 기준`}
          loading={loading}
        />
        <MetricCard
          label="전임교원수"
          value={point ? `${point.faculty.toLocaleString('ko-KR')}명` : null}
          caption={`${year}년 기준`}
          loading={loading}
        />
      </section>

      <section aria-label="1인당 논문 수 추이">
        <h2 className="mb-[var(--spacing-3)] text-lg font-semibold text-[var(--text-primary)]">
          1인당 논문 수 추이
        </h2>
        <TrendChart
          series={trendSeries}
          valueLabel="1인당 논문 수(편)"
          description={
            stats
              ? `${stats.university}, ${stats.regionName} 평균, 전국 평균의 1인당 논문 수 추이`
              : '추이 차트'
          }
          precision={4}
          loading={loading}
        />
      </section>

      <section aria-label="비교군 현황">
        <h2 className="mb-[var(--spacing-3)] text-lg font-semibold text-[var(--text-primary)]">
          비교군 현황
        </h2>
        <CompareTable
          rows={stats?.compare ?? []}
          caption={
            stats
              ? `${stats.year}년 ${stats.regionName} 비교군 ${stats.compare.length}개교 연구실적`
              : '비교군 연구실적'
          }
          highlightName={stats?.university}
          loading={loading}
        />
      </section>

      <section aria-label="전년 대비 증감">
        <h2 className="mb-[var(--spacing-3)] text-lg font-semibold text-[var(--text-primary)]">
          전년 대비 증감
        </h2>
        {/* baseYear 는 현재 연도, compareYear 는 그 이전 해다. 순서를 뒤집으면
            화면에 "2026 → 2025" 가 남는다(R-RS-03). */}
        <YoYPanel
          changes={stats?.yoy ?? { top: [], bottom: [], target: null }}
          baseYear={year ?? 0}
          compareYear={(year ?? 1) - 1}
          loading={loading}
        />
      </section>

      {dataset && (
        <p className="text-xs text-[var(--text-muted)]">{dataset.nationalRankScopeNote}</p>
      )}

      {stats?.compareGroupNote && (
        <p
          data-testid="compare-note"
          className="text-xs text-[var(--text-muted)]"
        >
          {stats.compareGroupNote}
        </p>
      )}
    </main>
  )
}
