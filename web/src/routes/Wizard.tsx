import { useEffect, useState } from 'react'

import { api, ApiError, byYear, type DatasetInfo } from '../api/client'
import { CompareTable } from '../components/CompareTable/CompareTable'
import { MetricCard } from '../components/MetricCard/MetricCard'
import type { DeltaDirection } from '../components/MetricCard/types'
import { StepNav } from '../components/StepNav/StepNav'
import { TrendChart } from '../components/TrendChart/TrendChart'
import { YoYPanel } from '../components/YoYPanel/YoYPanel'
import { useWizard } from '../store/WizardProvider'
import { NARRATIVE_KEYS, STEPS, type NarrativeKey } from '../store/types'

const NARRATIVE_LABELS: Record<NarrativeKey, string> = {
  trend: '연도별 추이',
  comparison: '비교군 비교',
  regional: '권역 내 위치',
  yoy: '전년 대비 증감',
}

/** 순위 변화는 API 가 이미 "양수 = 개선" 으로 계산해 온다. 다시 뒤집지 않는다(V09). */
function rankDirection(delta: number | null | undefined): DeltaDirection {
  if (delta === null || delta === undefined || delta === 0) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

function rankLabel(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '비교 없음'
  if (delta === 0) return '변동 없음'
  return `${delta > 0 ? '+' : ''}${delta}계단`
}

export function Wizard() {
  const { state, goto, next, reset, setNarrative, loadTarget } = useWizard()
  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [datasetError, setDatasetError] = useState<string | null>(null)
  /** 진행 중인 장시간 작업. 두 개가 동시에 돌지 않게 한 값으로 관리한다. */
  const [busy, setBusy] = useState<'narrative' | 'report' | null>(null)
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .dataset()
      .then((d) => alive && setDataset(d))
      .catch((e) => alive && setDatasetError(String(e)))
    return () => {
      alive = false
    }
  }, [])

  const { stats, step, maxStep, loading, error, narratives } = state

  async function generateAll() {
    if (!stats) return
    setBusy('narrative')
    setActionError(null)
    try {
      const res = await api.narrative({
        university: stats.university,
        year: stats.year,
        regionName: stats.regionName,
        compareGroup: stats.compareGroup,
      })
      for (const [key, text] of Object.entries(res.narratives)) {
        setNarrative(key as NarrativeKey, text)
      }
      setFailed(res.failed)
    } catch (e) {
      setActionError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function downloadReport() {
    if (!stats) return
    setBusy('report')
    setActionError(null)
    try {
      const { blob, filename } = await api.report({
        university: stats.university,
        year: stats.year,
        regionName: stats.regionName,
        compareGroup: stats.compareGroup,
        narratives,
      })
      // 브라우저 다운로드는 임시 <a> 를 만들어 클릭하는 것이 유일한 방법이다.
      // objectURL 을 해제하지 않으면 blob 이 탭이 닫힐 때까지 메모리에 남는다.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setActionError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setBusy(null)
    }
  }
  const year = stats?.year
  const point = year ? stats?.trend[String(year)] : undefined
  const rank = year ? stats?.rankChanges[String(year)] : undefined

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
    <div className="flex flex-col gap-[var(--spacing-5)]">
      <StepNav current={step} maxStep={maxStep} onSelect={goto} />

      <h2 className="m-0 text-lg font-semibold text-[var(--text-primary)]">
        {step}단계: {STEPS[step - 1]}
      </h2>

      {(error || datasetError || actionError) && (
        <p
          role="alert"
          data-testid="api-error"
          className="
            m-0 rounded-[var(--radius-md)] border border-[var(--color-down)]
            bg-[var(--color-down-soft)] p-[var(--spacing-4)]
            text-sm text-[var(--color-down)]
          "
        >
          {actionError ? '작업에 실패했다' : '데이터를 불러오지 못했다'}:{' '}
          {error ?? datasetError ?? actionError}
        </p>
      )}

      {/* ── 1단계: 데이터 설정 ─────────────────────────────────────────── */}
      {step === 1 && (
        <section aria-label="데이터 설정" className="flex flex-col gap-[var(--spacing-4)]">
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            분석할 대학과 기준 연도를 고른다. 권역은 서버가 자동으로 판정한다.
          </p>
          <TargetPicker
            dataset={dataset}
            loading={loading}
            selected={state.university}
            selectedYear={state.year}
            onPick={loadTarget}
          />
          {stats && (
            <p data-testid="load-summary" className="m-0 text-sm text-[var(--text-secondary)]">
              <strong>{stats.university}</strong> · {stats.regionName} · {stats.year}년 ·
              비교군 {stats.compareGroup.length}개교
            </p>
          )}
          {stats?.compareGroupNote && (
            <p data-testid="compare-note" className="m-0 text-xs text-[var(--text-muted)]">
              {stats.compareGroupNote}
            </p>
          )}
        </section>
      )}

      {/* ── 2단계: 통계 확인 ───────────────────────────────────────────── */}
      {step === 2 && (
        <section
          aria-label="주요 지표"
          className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-[var(--spacing-4)]"
        >
          <MetricCard
            label="전국순위"
            value={point?.nationalRank != null ? `${point.nationalRank}위` : null}
            caption={dataset ? `${year}년 · 등재 사립 ${dataset.universityCount}개교` : undefined}
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
            caption={stats?.regionName}
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
          />
          <MetricCard
            label="전임교원수"
            value={point ? `${point.faculty.toLocaleString('ko-KR')}명` : null}
            caption={`${year}년 기준`}
          />
        </section>
      )}

      {/* ── 3단계: 그래프 검토 ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-[var(--spacing-5)]">
          <section aria-label="1인당 논문 수 추이">
            <TrendChart
              series={trendSeries}
              valueLabel="1인당 논문 수(편)"
              description={
                stats
                  ? `${stats.university}, ${stats.regionName} 평균, 전국 평균의 1인당 논문 수 추이`
                  : '추이 차트'
              }
              precision={4}
            />
          </section>
          <section aria-label="비교군 현황">
            <CompareTable
              rows={stats?.compare ?? []}
              caption={
                stats
                  ? `${stats.year}년 ${stats.regionName} 비교군 ${stats.compare.length}개교 연구실적`
                  : '비교군 연구실적'
              }
              highlightName={stats?.university}
            />
          </section>
          <section aria-label="전년 대비 증감">
            {/* baseYear 가 현재, compareYear 가 이전이다. 뒤집으면 화면에
                "2026 → 2025" 가 남는다(R-RS-03). */}
            <YoYPanel
              changes={stats?.yoy ?? { top: [], bottom: [], target: null }}
              baseYear={year ?? 0}
              compareYear={(year ?? 1) - 1}
            />
          </section>
        </div>
      )}

      {/* ── 4단계: GPT 서술 ────────────────────────────────────────────── */}
      {step === 4 && (
        <section aria-label="서술 편집" className="flex flex-col gap-[var(--spacing-4)]">
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            서술은 단계를 오가도 사라지지 않는다. 원본 Streamlit 판에서는 4단계를
            벗어나면 입력이 지워졌다.
          </p>

          <div className="flex flex-wrap items-center gap-[var(--spacing-3)]">
            <button
              type="button"
              data-testid="generate-button"
              disabled={!stats || busy !== null}
              onClick={generateAll}
              className="
                rounded-[var(--radius-md)] border border-[var(--accent)]
                bg-[var(--accent)] px-[var(--spacing-4)] py-[var(--spacing-2)]
                text-sm font-medium text-[var(--text-on-brand)]
                disabled:cursor-not-allowed disabled:opacity-50
              "
            >
              {busy === 'narrative' ? '생성 중…' : 'GPT 서술 일괄 생성'}
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              API 키는 서버에만 있다. 생성된 글은 직접 고쳐도 된다.
            </span>
          </div>

          {/* 일부만 실패해도 나머지는 채워진다. 실패를 조용히 빈 칸으로 두면
              GPT 가 "아무 말도 하지 않았다" 고 오해한다. */}
          {Object.keys(failed).length > 0 && (
            <ul
              role="alert"
              data-testid="narrative-failed"
              className="
                m-0 list-none rounded-[var(--radius-md)]
                border border-[var(--color-down)] bg-[var(--color-down-soft)]
                p-[var(--spacing-3)] text-xs text-[var(--color-down)]
              "
            >
              {Object.entries(failed).map(([key, reason]) => (
                <li key={key}>
                  {NARRATIVE_LABELS[key as NarrativeKey] ?? key}: {reason}
                </li>
              ))}
            </ul>
          )}
          {NARRATIVE_KEYS.map((key) => (
            <label key={key} className="flex flex-col gap-[var(--spacing-2)]">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {NARRATIVE_LABELS[key]}
              </span>
              <textarea
                data-testid={`narrative-${key}`}
                value={narratives[key]}
                onChange={(e) => setNarrative(key, e.target.value)}
                rows={4}
                className="
                  w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)]
                  bg-[var(--surface-raised)] p-[var(--spacing-3)]
                  font-[family-name:var(--font-sans)] text-sm text-[var(--text-primary)]
                "
              />
            </label>
          ))}
        </section>
      )}

      {/* ── 5단계: 보고서 생성 ─────────────────────────────────────────── */}
      {step === 5 && (
        <section aria-label="보고서 생성" className="flex flex-col gap-[var(--spacing-4)]">
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            아래 내용으로 Word 보고서를 만든다. 서술이 비어 있으면 그 절은
            제목만 들어간다.
          </p>
          <ul data-testid="report-summary" className="m-0 list-none p-0 text-sm">
            {NARRATIVE_KEYS.map((key) => (
              <li key={key} className="py-[var(--spacing-1)] text-[var(--text-secondary)]">
                {NARRATIVE_LABELS[key]}:{' '}
                <span className="text-[var(--text-primary)]">
                  {narratives[key] ? `${narratives[key].length}자` : '비어 있음'}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            data-testid="download-button"
            disabled={!stats || busy !== null}
            onClick={downloadReport}
            className="
              w-fit rounded-[var(--radius-md)] border border-[var(--accent)]
              bg-[var(--accent)] px-[var(--spacing-5)] py-[var(--spacing-3)]
              text-sm font-medium text-[var(--text-on-brand)]
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {busy === 'report' ? 'Word 만드는 중…' : 'Word 보고서 내려받기'}
          </button>
        </section>
      )}

      {/* ── 이동 ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-[var(--spacing-3)]">
        {step > 1 && (
          <button
            type="button"
            data-testid="prev-button"
            onClick={() => goto((step - 1) as typeof step)}
            className="
              rounded-[var(--radius-md)] border border-[var(--border-subtle)]
              bg-[var(--surface-raised)] px-[var(--spacing-4)] py-[var(--spacing-2)]
              text-sm text-[var(--text-secondary)]
              hover:border-[var(--border-strong)]
            "
          >
            ← 이전
          </button>
        )}
        {step < 5 && (
          <button
            type="button"
            data-testid="next-button"
            disabled={!stats}
            onClick={next}
            className="
              rounded-[var(--radius-md)] border border-[var(--accent)]
              bg-[var(--accent)] px-[var(--spacing-4)] py-[var(--spacing-2)]
              text-sm font-medium text-[var(--text-on-brand)]
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            다음 →
          </button>
        )}
        <button
          type="button"
          data-testid="reset-button"
          onClick={reset}
          className="
            ml-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)]
            bg-[var(--surface-raised)] px-[var(--spacing-4)] py-[var(--spacing-2)]
            text-sm text-[var(--text-muted)]
            hover:border-[var(--color-down)] hover:text-[var(--color-down)]
          "
        >
          처음부터 다시
        </button>
      </div>

      {dataset && (
        <p className="m-0 text-xs text-[var(--text-muted)]">{dataset.nationalRankScopeNote}</p>
      )}
    </div>
  )
}

/** 대상 대학·연도 선택. 목록은 데이터셋 정보에서 가져온다. */
function TargetPicker({
  dataset,
  loading,
  selected,
  selectedYear,
  onPick,
}: {
  dataset: DatasetInfo | null
  loading: boolean
  selected: string | null
  selectedYear: number | null
  onPick: (university: string, year: number) => void
}) {
  const latest = dataset?.years[dataset.years.length - 1]
  const [university, setUniversity] = useState(selected ?? '호서대학교')
  const [year, setYear] = useState<number | null>(selectedYear ?? null)

  const effectiveYear = year ?? latest ?? null

  return (
    <div className="flex flex-wrap items-end gap-[var(--spacing-3)]">
      <label className="flex flex-col gap-[var(--spacing-1)]">
        <span className="text-sm text-[var(--text-secondary)]">대상 대학</span>
        <input
          data-testid="university-input"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          className="
            rounded-[var(--radius-md)] border border-[var(--border-subtle)]
            bg-[var(--surface-raised)] px-[var(--spacing-3)] py-[var(--spacing-2)]
            text-sm text-[var(--text-primary)]
          "
        />
      </label>

      <label className="flex flex-col gap-[var(--spacing-1)]">
        <span className="text-sm text-[var(--text-secondary)]">기준 연도</span>
        <select
          data-testid="year-select"
          value={effectiveYear ?? ''}
          onChange={(e) => setYear(Number(e.target.value))}
          disabled={!dataset}
          className="
            rounded-[var(--radius-md)] border border-[var(--border-subtle)]
            bg-[var(--surface-raised)] px-[var(--spacing-3)] py-[var(--spacing-2)]
            text-sm text-[var(--text-primary)]
          "
        >
          {dataset?.years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        data-testid="load-button"
        disabled={loading || !effectiveYear}
        onClick={() => effectiveYear && onPick(university, effectiveYear)}
        className="
          rounded-[var(--radius-md)] border border-[var(--accent)]
          bg-[var(--accent)] px-[var(--spacing-4)] py-[var(--spacing-2)]
          text-sm font-medium text-[var(--text-on-brand)]
          disabled:cursor-not-allowed disabled:opacity-50
        "
      >
        {loading ? '불러오는 중…' : '불러오기'}
      </button>
    </div>
  )
}
