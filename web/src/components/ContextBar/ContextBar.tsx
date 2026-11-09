import type { StatsResponse } from '../../api/client'
import { Button } from '../../design/ui'

export interface ContextBarProps {
  readonly stats: StatsResponse
  /** 「변경」 — 1단계로 돌아간다. */
  readonly onChange: () => void
}

/**
 * 2단계부터 상단바 아래에 붙어 따라오는 한 줄.
 *
 * 5단계를 오가는 동안 "지금 무엇을 보고 있는가" 가 화면에서 사라지면 사용자는
 * 1단계로 돌아가 확인한다. 대상·권역·기준 연도·개년·비교군 수를 한 줄로 두고,
 * 바꾸는 길도 여기 둔다.
 *
 * 개년은 **실제로 표에 들어간 해**(`trend` 의 키 수)다. 고른 연도 수가 아니다 —
 * 일부 연도만 있는 대학은 둘이 다르고, 틀린 쪽은 화면이다.
 */
export function ContextBar({ stats, onChange }: ContextBarProps) {
  const yearCount = Object.keys(stats.trend).length

  return (
    <div
      data-testid="context-bar"
      className="
        sticky top-[var(--appbar-h)] z-10 flex h-[var(--contextbar-h)] items-center
        justify-between gap-[var(--spacing-3)] border-b border-[var(--border-subtle)]
        bg-[var(--surface-base)] text-body text-[var(--text-secondary)]
      "
    >
      <p className="m-0 min-w-0 truncate">
        <strong className="font-semibold text-[var(--text-primary)]">{stats.university}</strong>
        {` · ${stats.regionName} · ${stats.year}년 공시 · ${yearCount}개년 · 비교군 ${stats.compare.length}개교`}
      </p>
      <Button size="sm" variant="ghost" data-testid="context-change" onClick={onChange}>
        변경
      </Button>
    </div>
  )
}
