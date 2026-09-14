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
 * 4단계: GPT 서술.
 *
 * 두 가지를 되살린다.
 *
 * 1. **절 단위 생성.** 원본은 절마다 생성 버튼이 있었다. 하나만 마음에 안
 *    들 때 넷을 다시 돌리면 돈과 시간이 네 배로 든다.
 * 2. **이미 쓴 글을 덮어쓰지 않는다.** 원본의 일괄 생성은 **비어 있는 절만**
 *    채웠다. 이관하면서 전부 덮어쓰게 되어, 손으로 고친 글이 한 번의 클릭에
 *    사라졌다. 절 버튼은 명시적 재생성이라 덮어쓰는 것이 맞다.
 */
export function Step4Narrative({ state, actions }: StepProps) {
  const { stats, narratives } = state
  /** 지금 생성 중인 절. 'all' 은 일괄. 두 개가 동시에 돌지 않게 한 값으로 관리. */
  const [busy, setBusy] = useState<NarrativeKey | 'all' | null>(null)
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const filled = NARRATIVE_KEYS.filter((k) => narratives[k].trim().length > 0)
  const emptyKeys = NARRATIVE_KEYS.filter((k) => narratives[k].trim().length === 0)

  async function generate(keys: readonly NarrativeKey[], marker: NarrativeKey | 'all') {
    if (!stats || keys.length === 0) return
    setBusy(marker)
    setError(null)
    try {
      const res = await api.narrative({
        university: stats.university,
        year: stats.year,
        regionName: stats.regionName,
        compareGroup: [...stats.compareGroup],
        keys: [...keys],
      })
      for (const [key, text] of Object.entries(res.narratives)) {
        actions.setNarrative(key, text)
      }
      setFailed(res.failed)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-5)]">
      <div className="flex flex-wrap items-center gap-[var(--spacing-4)]">
        <Button
          variant="primary"
          data-testid="generate-button"
          disabled={!stats || emptyKeys.length === 0}
          busy={busy === 'all'}
          busyLabel="생성 중…"
          onClick={() => generate(emptyKeys, 'all')}
        >
          {emptyKeys.length === NARRATIVE_KEYS.length
            ? 'GPT 서술 일괄 생성'
            : `비어 있는 ${emptyKeys.length}개 절 생성`}
        </Button>

        {/* 어디까지 왔는지. 원본에 있던 "섹션 N/4" 안내다. */}
        <span data-testid="narrative-progress" className="text-sm text-[var(--text-secondary)]">
          섹션 {filled.length}/{NARRATIVE_KEYS.length} 작성됨
        </span>

        <span className="text-xs text-[var(--text-muted)]">
          API 키는 서버에만 있다. 생성된 글은 직접 고쳐도 되고, 일괄 생성은
          이미 쓴 글을 덮어쓰지 않는다.
        </span>
      </div>

      {error && (
        <p
          role="alert"
          data-testid="narrative-error"
          className="
            m-0 rounded-[var(--radius-md)] border border-[var(--color-down)]
            bg-[var(--color-down-soft)] p-[var(--spacing-4)]
            text-sm text-[var(--color-down)]
          "
        >
          {error}
        </p>
      )}

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
        <section
          key={key}
          aria-label={NARRATIVE_LABELS[key]}
          className="
            flex flex-col gap-[var(--spacing-2)]
            border-t border-[var(--border-subtle)] pt-[var(--spacing-4)]
          "
        >
          <div className="flex flex-wrap items-center justify-between gap-[var(--spacing-3)]">
            <label
              htmlFor={`narrative-${key}`}
              className="text-sm font-semibold text-[var(--text-primary)]"
            >
              {NARRATIVE_LABELS[key]}
            </label>
            <Button
              size="sm"
              data-testid={`generate-${key}`}
              disabled={!stats || busy !== null}
              busy={busy === key}
              busyLabel="생성 중…"
              onClick={() => generate([key], key)}
            >
              {narratives[key].trim() ? '다시 생성' : '생성'}
            </Button>
          </div>
          <textarea
            id={`narrative-${key}`}
            data-testid={`narrative-${key}`}
            value={narratives[key]}
            onChange={(e) => actions.setNarrative(key, e.target.value)}
            rows={5}
            className="
              w-full rounded-[var(--radius-md)] border border-[var(--border-strong)]
              bg-[var(--surface-raised)] p-[var(--spacing-3)]
              font-[family-name:var(--font-sans)] text-sm leading-relaxed
              text-[var(--text-primary)]
            "
          />
          <p className="m-0 text-xs text-[var(--text-muted)]">
            {narratives[key].length}자
          </p>
        </section>
      ))}
    </div>
  )
}
