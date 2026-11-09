import { cn } from '../../lib/cn'
import type { DeltaDirection, MetricCardProps } from './types'

/** 값 없음 기호. `0` 이나 빈 문자열과 구분해야 한다. */
const EMPTY = '—'

const ARROW: Record<DeltaDirection, string> = {
  up: '▲',
  down: '▼',
  flat: '',
}

/**
 * 지표 한 칸.
 *
 * 스스로 테두리·배경을 갖지 않는다 — 띠(부모 패널, `Card variant="panel"`)가
 * 선으로 칸을 나눈다. 카드 넷이 각자 떠 있으면 어느 숫자가 답인지 보이지 않는다.
 *
 * 라벨은 아이브로, 값은 Geist Mono(`--font-numeric`) — 답 하나(`answer`)만 kpi
 * 크기에 700, 나머지는 kpi-sub 에 500 이다(DESIGN.md §3). 단위는 캡션 크기로
 * 작게 붙는다.
 *
 * 방향 판정은 하지 않는다 — `delta.direction` 을 그대로 믿고 그린다.
 * 카드가 부호를 다시 해석하는 순간 V09(개선이 하락으로 표시)가 재현된다.
 * 증감은 알약이 아니라 **문장**이다. 색은 숫자에만 있고, 의미는 화살표와
 * 음성 라벨이 따로 전달한다.
 */
export function MetricCard({
  label,
  value,
  unit,
  caption,
  delta,
  size = 'default',
  loading = false,
}: MetricCardProps) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-2)] p-[var(--spacing-4)]">
      <span className="eyebrow text-[var(--text-secondary)]">{label}</span>

      {loading ? (
        <div
          data-testid="metric-skeleton"
          aria-hidden="true"
          className="h-[2rem] w-2/3 animate-pulse bg-[var(--surface-sunken)]"
        />
      ) : value === null ? (
        // 큰 숫자 자리에 큰 대시를 그리면 "큰 결측" 이 된다. 작게, 그리고 왜
        // 없는지는 음성으로.
        <span className="flex items-baseline">
          <span className="text-body text-[var(--text-muted)]">{EMPTY}</span>
          <span className="sr-only">자료 없음</span>
        </span>
      ) : (
        <span className="flex items-baseline gap-[var(--spacing-1)] text-[var(--text-primary)]">
          <span
            className={cn(
              'font-[family-name:var(--font-numeric)] tabular-nums',
              size === 'answer' ? 'text-kpi font-bold' : 'text-kpi-sub font-medium',
            )}
          >
            {value}
          </span>
          {unit && <span className="text-meta text-[var(--text-muted)]">{unit}</span>}
        </span>
      )}

      {caption && <span className="text-meta text-[var(--text-muted)]">{caption}</span>}

      {delta && (
        <p
          data-testid="metric-delta"
          data-direction={delta.direction}
          className="group m-0 text-body text-[var(--text-secondary)]"
        >
          {/* 화살표는 장식이다. 의미는 아래 sr-only 가 전달한다. */}
          <span
            aria-hidden="true"
            className="
              font-medium
              group-data-[direction=up]:text-[var(--color-up)]
              group-data-[direction=down]:text-[var(--color-down)]
            "
          >
            {ARROW[delta.direction] && `${ARROW[delta.direction]} `}
            {delta.label}
          </span>
          <span className="sr-only">{delta.srLabel}</span>
        </p>
      )}
    </div>
  )
}
