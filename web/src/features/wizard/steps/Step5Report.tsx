import { useState } from 'react'

import { api, ApiError } from '../../../api/client'
import { Button } from '../../../design/ui'
import { NARRATIVE_KEYS, type NarrativeKey } from '../../../store/types'
import type { StepProps } from './types'

const NARRATIVE_LABELS: Record<NarrativeKey, string> = {
  trend: '연도별 추이',
  comparison: '비교군 비교',
  regional: '권역 내 위치',
  yoy: '전년 대비 증감',
}

/**
 * 5단계: Word 보고서.
 *
 * 문서를 만들기 전에 **무엇이 들어가는지** 보여준다. 원본은 "생성" 버튼만
 * 있어서, 비어 있는 절이 있어도 문서를 열어 봐야 알았다.
 */
export function Step5Report({ state }: StepProps) {
  const { stats, narratives } = state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const empty = NARRATIVE_KEYS.filter((k) => !narratives[k].trim())

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
      setError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!stats) return null

  return (
    <div className="flex flex-col gap-[var(--spacing-5)]">
      <dl
        data-testid="report-summary"
        className="
          m-0 grid gap-x-[var(--spacing-5)] gap-y-[var(--spacing-2)]
          sm:grid-cols-[auto_1fr]
        "
      >
        <dt className="text-sm text-[var(--text-secondary)]">대상</dt>
        <dd className="m-0 text-sm text-[var(--text-primary)]">
          {stats.university} · {stats.regionName} · {stats.year}년
        </dd>

        <dt className="text-sm text-[var(--text-secondary)]">비교군</dt>
        <dd className="m-0 text-sm text-[var(--text-primary)]">
          {stats.compareGroup.length}개교 ({stats.compareGroup.join(', ')})
        </dd>

        <dt className="text-sm text-[var(--text-secondary)]">차트</dt>
        <dd className="m-0 text-sm text-[var(--text-primary)]">
          5장 (3단계에서 확인한 것과 같다)
        </dd>

        {NARRATIVE_KEYS.map((key) => (
          <div key={key} className="contents">
            <dt className="text-sm text-[var(--text-secondary)]">
              {NARRATIVE_LABELS[key]}
            </dt>
            <dd className="m-0 text-sm">
              {narratives[key].trim() ? (
                <span className="text-[var(--text-primary)]">
                  {narratives[key].length}자
                </span>
              ) : (
                <span className="text-[var(--text-muted)]">비어 있음 — 제목만 들어간다</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {empty.length > 0 && (
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          {empty.length}개 절이 비어 있다. 4단계로 돌아가 채우거나, 이대로 만들어도 된다.
        </p>
      )}

      {error && (
        <p role="alert" data-testid="report-error" className="m-0 text-sm text-[var(--color-down)]">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-fit"
        data-testid="download-button"
        busy={busy}
        busyLabel="Word 만드는 중…"
        onClick={download}
      >
        Word 보고서 내려받기
      </Button>
    </div>
  )
}
