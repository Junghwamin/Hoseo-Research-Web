import type { DeltaDirection, MetricCardProps } from './types'

/** 값 없음 기호. `0` 이나 빈 문자열과 구분해야 한다. */
const EMPTY = '—'

const ARROW: Record<DeltaDirection, string> = {
  up: '▲',
  down: '▼',
  flat: '',
}

/**
 * 지표 카드.
 *
 * 방향 판정은 하지 않는다 — `delta.direction` 을 그대로 믿고 그린다.
 * 카드가 부호를 다시 해석하는 순간 V09(개선이 하락으로 표시)가 재현된다.
 */
export function MetricCard({
  label,
  value,
  caption,
  delta,
  loading = false,
}: MetricCardProps) {
  return (
    <div
      className="
        flex flex-col gap-[var(--spacing-2)]
        rounded-[var(--radius-lg)] border border-[var(--border-subtle)]
        bg-[var(--surface-raised)] p-[var(--spacing-5)]
        shadow-[var(--shadow-sm)]
        transition-[box-shadow,transform] duration-[var(--duration-base)]
        [transition-timing-function:var(--ease-out-quart)]
        hover:-translate-y-px hover:shadow-[var(--shadow-md)]
      "
    >
      <span className="text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </span>

      {loading ? (
        <div
          data-testid="metric-skeleton"
          aria-hidden="true"
          className="
            h-[2rem] w-2/3 animate-pulse
            rounded-[var(--radius-sm)] bg-[var(--surface-sunken)]
          "
        />
      ) : (
        <span
          className="
            font-[family-name:var(--font-numeric)] text-3xl font-semibold
            tabular-nums text-[var(--text-primary)]
          "
        >
          {value === null ? EMPTY : value}
        </span>
      )}

      {caption && (
        <span className="text-xs text-[var(--text-muted)]">{caption}</span>
      )}

      {delta && (
        <span
          data-testid="metric-delta"
          data-direction={delta.direction}
          className="
            inline-flex w-fit items-center gap-[var(--spacing-1)]
            rounded-[var(--radius-full)] px-[var(--spacing-2)] py-[var(--spacing-1)]
            text-xs font-semibold
            data-[direction=up]:bg-[var(--color-up-soft)]
            data-[direction=up]:text-[var(--color-up)]
            data-[direction=down]:bg-[var(--color-down-soft)]
            data-[direction=down]:text-[var(--color-down)]
            data-[direction=flat]:bg-[var(--color-neutral-soft)]
            data-[direction=flat]:text-[var(--color-neutral)]
          "
        >
          {/* 화살표는 장식이다. 의미는 아래 sr-only 가 전달한다. */}
          {ARROW[delta.direction] && (
            <span aria-hidden="true">{ARROW[delta.direction]}</span>
          )}
          <span aria-hidden="true">{delta.label}</span>
          <span className="sr-only">{delta.srLabel}</span>
        </span>
      )}
    </div>
  )
}
