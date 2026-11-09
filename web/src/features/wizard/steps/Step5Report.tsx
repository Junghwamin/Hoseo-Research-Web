import { useState, type ReactNode } from 'react'

import { api, ApiError, CHART_TITLES, type ChartKind } from '../../../api/client'
import { Button } from '../../../design/ui'
import { NARRATIVE_KEYS, type NarrativeKey, type Step } from '../../../store/types'
import type { StepProps } from './types'

const NARRATIVE_LABELS: Record<NarrativeKey, string> = {
  trend: '연도별 추이',
  comparison: '비교군 비교',
  regional: '권역 내 위치',
  yoy: '전년 대비 증감',
}

/** Word 보고서에 실리는 순서. 3단계와 같다. */
const WORD_ORDER: readonly ChartKind[] = ['trend', 'avg', 'bar', 'rank', 'compare']

/**
 * 5단계: 내려받기 전 확인.
 *
 * 문서를 만들기 전에 **무엇이 들어가는지** 보여준다. 원본은 "생성" 버튼만
 * 있어서, 비어 있는 절이 있어도 문서를 열어 봐야 알았다.
 *
 * 구획마다 「변경」이 있다(GOV.UK check-answers). 틀린 것을 발견했을 때
 * 돌아가는 길이 그 자리에 있어야 한다. 차트는 썸네일이 아니라 다섯 줄
 * 목록이다 — 3단계에서 본 그림을 작게 다시 보여주는 것은 확인이 아니라 장식이다.
 */
export function Step5Report({ state, actions }: StepProps) {
  const { stats, narratives } = state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 마지막으로 내려받은 파일명. 새 탭에 아무 반응 없이 끝나면 됐는지 알 수 없다. */
  const [downloaded, setDownloaded] = useState<string | null>(null)

  const empty = NARRATIVE_KEYS.filter((k) => !narratives[k].trim())

  // 보고서에 **실제로 들어가는** 해. 서버가 추이 계열에 담은 것이 곧 문서의
  // 표와 차트가 되므로, 요약도 같은 곳에서 뽑아야 문서와 어긋나지 않는다.
  const reportYears = stats
    ? Object.keys(stats.trend)
        .map(Number)
        .sort((a, b) => a - b)
    : []

  async function download() {
    if (!stats) return
    setBusy(true)
    setError(null)
    try {
      const { blob, filename } = await api.report({
        university: stats.university,
        year: stats.year,
        regionName: stats.regionName,
        compareGroup: [...stats.compareGroup],
        years: [...stats.years],
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
      setDownloaded(filename)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!stats) return null

  return (
    <div className="flex max-w-[var(--container-prose)] flex-col gap-[var(--spacing-6)]">
      <div data-testid="report-summary" className="flex flex-col gap-[var(--spacing-6)]">
        <Section title="분석 범위" changeId="change-scope" step={1} goto={actions.goto}>
          <dl
            className="
              m-0 grid gap-x-[var(--spacing-5)] gap-y-[var(--spacing-2)] text-body
              sm:grid-cols-[auto_1fr]
            "
          >
            <dt className="text-[var(--text-secondary)]">대상</dt>
            <dd className="m-0 text-[var(--text-primary)]">
              {stats.university} · {stats.regionName}
            </dd>
            <dt className="text-[var(--text-secondary)]">기준 연도</dt>
            <dd className="m-0 text-[var(--text-primary)]">{stats.year}년 공시</dd>
            <dt className="text-[var(--text-secondary)]">분석 연도</dt>
            <dd className="m-0 text-[var(--text-primary)]">
              {/* **문서에 실제로 들어간 해**를 적는다. 고른 연도를 그대로 쓰면
                  두 가지가 거짓이 된다 — 대상 대학에 없는 해가 포함되고
                  (제주국제대 2026), 비연속 선택이 "3개년 (2016–2026)" 처럼
                  11년치를 담은 것처럼 읽힌다. */}
              {reportYears.length}개년 ({reportYears.join(', ')})
            </dd>
            <dt className="text-[var(--text-secondary)]">비교군</dt>
            <dd className="m-0 text-[var(--text-primary)]">
              {stats.compareGroup.length}개교 ({stats.compareGroup.join(', ')})
            </dd>
          </dl>
        </Section>

        <Section title="차트 5장" changeId="change-charts" step={3} goto={actions.goto}>
          <ol
            data-testid="chart-list"
            className="m-0 flex list-decimal flex-col gap-[var(--spacing-1)] pl-[var(--spacing-5)] text-body text-[var(--text-primary)]"
          >
            {WORD_ORDER.map((kind) => (
              <li key={kind}>{CHART_TITLES[kind]}</li>
            ))}
          </ol>
          <p className="m-0 text-meta text-[var(--text-muted)]">3단계에서 확인한 그대로 들어갑니다.</p>
        </Section>

        <Section title="서술 4절" changeId="change-narratives" step={4} goto={actions.goto}>
          <ul className="m-0 flex list-none flex-col gap-[var(--spacing-3)] p-0">
            {NARRATIVE_KEYS.map((key) => {
              const text = narratives[key]
              const written = text.trim().length > 0
              return (
                <li key={key} className="flex flex-col gap-[var(--spacing-1)]">
                  <div className="flex items-baseline justify-between gap-[var(--spacing-3)] text-body">
                    <span className="font-medium text-[var(--text-primary)]">
                      {NARRATIVE_LABELS[key]}
                    </span>
                    {written ? (
                      <span className="tabular text-[var(--text-secondary)]">{text.length}자</span>
                    ) : (
                      <span className="text-[var(--text-muted)]">비어 있음 · 제목만 들어갑니다</span>
                    )}
                  </div>
                  {written && (
                    <p className="m-0 line-clamp-2 text-body text-[var(--text-secondary)]">{text}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>
      </div>

      {empty.length > 0 && (
        <p className="m-0 text-body text-[var(--text-secondary)]">
          {empty.length}개 절이 비어 있습니다. 4단계로 돌아가 채우거나, 이대로 만들어도 됩니다.
        </p>
      )}

      {error && (
        <p role="alert" data-testid="report-error" className="m-0 text-body text-[var(--color-down)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-[var(--spacing-4)]">
        <Button
          variant="primary"
          size="lg"
          data-testid="download-button"
          busy={busy}
          busyLabel="차트 5장을 그리고 문서를 조립하는 중…"
          onClick={download}
        >
          Word 보고서 내려받기
        </Button>
        {downloaded && (
          <p
            role="status"
            data-testid="report-done"
            className="m-0 text-body text-[var(--color-up)]"
          >
            내려받았습니다 · {downloaded}
          </p>
        )}
      </div>
    </div>
  )
}

/** 확인 화면의 한 구획. 제목 오른쪽에 그 단계로 돌아가는 「변경」이 있다. */
function Section({
  title,
  changeId,
  step,
  goto,
  children,
}: {
  title: string
  changeId: string
  step: Step
  goto: (step: Step) => void
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-[var(--spacing-3)] border-t border-[var(--border-subtle)] pt-[var(--spacing-5)]"
    >
      <div className="flex items-center justify-between gap-[var(--spacing-3)]">
        <h3 className="m-0 text-heading font-semibold text-[var(--text-primary)]">{title}</h3>
        <Button size="sm" variant="ghost" data-testid={changeId} onClick={() => goto(step)}>
          변경
        </Button>
      </div>
      {children}
    </section>
  )
}
