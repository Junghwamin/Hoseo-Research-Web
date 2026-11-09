import { Suspense, lazy, useState } from 'react'

import { api, ApiError } from '../../../api/client'
import { useClientKey } from '../../../api/clientKey'
import { Button, Pending } from '../../../design/ui'
import { NARRATIVE_KEYS, type NarrativeKey } from '../../../store/types'
import { useSettings } from '../hooks'
import type { StepProps } from './types'

// 설정 패널은 키가 없을 때만 필요하다. 첫 화면 번들에 넣지 않는다.
const SettingsPanel = lazy(() =>
  import('../../../components/SettingsPanel').then((m) => ({ default: m.SettingsPanel })),
)

const NARRATIVE_LABELS: Record<NarrativeKey, string> = {
  trend: '연도별 추이',
  comparison: '비교군 비교',
  regional: '권역 내 위치',
  yoy: '전년 대비 증감',
}

/**
 * 4단계: GPT 서술.
 *
 * 세 가지를 지킨다.
 *
 * 1. **절 단위 생성.** 원본은 절마다 생성 버튼이 있었다. 하나만 마음에 안
 *    들 때 넷을 다시 돌리면 돈과 시간이 네 배로 든다.
 * 2. **이미 쓴 글을 덮어쓰지 않는다.** 원본의 일괄 생성은 **비어 있는 절만**
 *    채웠다. 이관하면서 전부 덮어쓰게 되어, 손으로 고친 글이 한 번의 클릭에
 *    사라졌다. 절 버튼은 명시적 재생성이라 덮어쓰는 것이 맞다.
 * 3. **키가 없으면 누르기 전에 말한다.** 서버 설정과 브라우저 키를 먼저 보고,
 *    둘 다 없으면 설정 패널을 이 자리에 둔다(V16: "⚠ 미설정" 만 뜨고 할 수 있는
 *    일이 없었다). 패널은 배포 종류에 따라 서버 저장 폼 또는 브라우저 키 폼을
 *    스스로 고른다. 생성 버튼은 어느 경우에도 남는다 — 눌렀을 때 서버가 이유를
 *    돌려주는 경로도 계약이다.
 *
 * 일괄 생성은 **절마다 요청을 따로** 보낸다. 서버리스 함수 한 번이 GPT 호출 1회로
 * 끝나고, 하나가 실패해도 나머지는 들어온다.
 */
export function Step4Narrative({ state, actions }: StepProps) {
  const { stats, narratives } = state
  const settings = useSettings()
  const clientKey = useClientKey()
  /** 지금 생성 중인 절. 'all' 은 일괄. 두 개가 동시에 돌지 않게 한 값으로 관리. */
  const [busy, setBusy] = useState<NarrativeKey | 'all' | null>(null)
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const filled = NARRATIVE_KEYS.filter((k) => narratives[k].trim().length > 0)
  const emptyKeys = NARRATIVE_KEYS.filter((k) => narratives[k].trim().length === 0)

  const keyMissing = settings.data ? !settings.data.apiKeyConfigured && !clientKey : false
  const browserMode = settings.data?.canPersist === false

  function detailOf(e: unknown): string {
    // 서버 문구에 든 마크다운 강조(**)는 화면에서 글자 그대로 보인다.
    const detail = e instanceof ApiError ? e.detail : e instanceof Error ? e.message : String(e)
    return detail.replace(/\*\*/g, '')
  }

  async function generate(keys: readonly NarrativeKey[], marker: NarrativeKey | 'all') {
    if (!stats || keys.length === 0) return
    setBusy(marker)
    setError(null)
    const base = {
      university: stats.university,
      year: stats.year,
      regionName: stats.regionName,
      compareGroup: [...stats.compareGroup],
      // 서술의 근거가 되는 숫자는 화면에 보이는 것과 같아야 한다.
      // 연도를 빼면 GPT 는 11개년을 보고 쓰는데 화면엔 3개년만 있다.
      years: [...stats.years],
    }

    // 절마다 요청 하나. 전부 끝날 때까지 기다리되 하나의 실패가 나머지를 버리지 않는다.
    const settled = await Promise.allSettled(keys.map((key) => api.narrative({ ...base, keys: [key] })))

    const nextFailed: Record<string, string> = {}
    let delivered = 0
    settled.forEach((outcome, i) => {
      const key = keys[i]
      if (outcome.status === 'fulfilled') {
        for (const [k, text] of Object.entries(outcome.value.narratives)) {
          actions.setNarrative(k, text)
          delivered += 1
        }
        Object.assign(nextFailed, outcome.value.failed)
      } else {
        nextFailed[key] = detailOf(outcome.reason)
      }
    })

    // 한 절도 오지 않았고 전부 같은 이유(키 없음 등)라면 목록 대신 한 문장으로 말한다.
    const rejected = settled.filter((o) => o.status === 'rejected')
    if (delivered === 0 && rejected.length === settled.length && rejected.length > 0) {
      setError(detailOf((rejected[0] as PromiseRejectedResult).reason))
      setFailed({})
    } else {
      setFailed(nextFailed)
    }
    setBusy(null)
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-5)]">
      {keyMissing && (
        <section
          aria-label="OpenAI 키 설정"
          className="
            flex flex-col gap-[var(--spacing-4)]
            border border-[var(--border-strong)] bg-[var(--surface-raised)]
            p-[var(--spacing-5)] shadow-[var(--shadow-soft)]
          "
        >
          {/* 설명은 패널이 한다(어디에 저장되는지). 여기서는 왜 이 자리에 폼이 있는지만 말한다. */}
          <p className="m-0 text-body text-[var(--text-primary)]">
            {browserMode
              ? 'GPT 서술에는 OpenAI API 키가 필요합니다. 아래에 넣으면 바로 쓸 수 있습니다.'
              : 'GPT 서술을 쓰려면 OpenAI 키가 필요합니다. 키는 이 PC 의 서버에만 저장됩니다.'}
          </p>
          <Suspense fallback={<Pending label="설정을 불러오는 중" />}>
            <SettingsPanel embedded onClose={settings.reload} onSaved={settings.reload} />
          </Suspense>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-[var(--spacing-4)]">
        {/* 키가 없으면 주 행동이 아니다 — 설정 폼의 「저장」이 주 행동이다.
            버튼은 남기되 보조 버튼으로 내린다. */}
        <Button
          variant={keyMissing ? 'secondary' : 'primary'}
          data-testid="generate-button"
          disabled={!stats || emptyKeys.length === 0}
          busy={busy === 'all'}
          busyLabel="생성 중…"
          onClick={() => generate(emptyKeys, 'all')}
        >
          {emptyKeys.length === NARRATIVE_KEYS.length
            ? '4개 절 모두 생성'
            : `비어 있는 ${emptyKeys.length}개 절 생성`}
        </Button>

        {/* 어디까지 왔는지. 원본에 있던 "섹션 N/4" 안내다. */}
        <span data-testid="narrative-progress" className="text-body text-[var(--text-secondary)]">
          섹션 {filled.length}/{NARRATIVE_KEYS.length} 작성됨
        </span>

        <span className="text-meta text-[var(--text-muted)]">
          이미 쓴 글은 덮어쓰지 않습니다. 생성한 글은 바로 고칠 수 있습니다.
        </span>
      </div>

      {error && (
        <p
          role="alert"
          data-testid="narrative-error"
          className="
            m-0 border border-[var(--color-down)]
            bg-[var(--color-down-soft)] p-[var(--spacing-4)]
            text-body text-[var(--color-down)]
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
            m-0 list-none border border-[var(--color-down)]
            bg-[var(--color-down-soft)] p-[var(--spacing-3)]
            text-body text-[var(--color-down)]
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
              className="text-heading font-semibold text-[var(--text-primary)]"
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
          {/* 휴대폰에서 16px 아래 입력은 iOS 가 포커스 때 화면을 확대한다. */}
          <textarea
            id={`narrative-${key}`}
            data-testid={`narrative-${key}`}
            value={narratives[key]}
            onChange={(e) => actions.setNarrative(key, e.target.value)}
            rows={5}
            className="
              w-full border border-[var(--border-strong)]
              bg-[var(--surface-raised)] p-[var(--spacing-3)]
              font-[family-name:var(--font-sans)] text-lead text-[var(--text-primary)]
              md:text-body
            "
          />
          <p className="m-0 text-meta text-[var(--text-muted)]">{narratives[key].length}자</p>
        </section>
      ))}
    </div>
  )
}
