import { STEPS, type Step } from '../../store/types'

export interface StepNavProps {
  readonly current: Step
  /** 여기까지만 클릭할 수 있다. */
  readonly maxStep: Step
  readonly onSelect: (step: Step) => void
}

/**
 * 5단계 진행 표시 겸 이동.
 *
 * 도달하지 않은 단계는 `disabled` 로 둔다 — 여기서는 "있는데 안 되는 기능" 이
 * 아니라 **진행 상태의 표현**이라 보여주는 것이 맞다. 미구현 모듈을 숨기는
 * 규칙(§6)과 다른 경우다. 다만 왜 못 누르는지는 음성으로 알려야 한다.
 */
export function StepNav({ current, maxStep, onSelect }: StepNavProps) {
  return (
    <nav aria-label="분석 단계">
      <ol className="m-0 flex list-none flex-wrap gap-[var(--spacing-2)] p-0">
        {STEPS.map((label, i) => {
          const step = (i + 1) as Step
          const reached = step <= maxStep
          const isCurrent = step === current

          return (
            <li key={label}>
              <button
                type="button"
                data-testid={`step-${step}`}
                data-state={isCurrent ? 'current' : reached ? 'reached' : 'locked'}
                disabled={!reached}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={
                  reached
                    ? `${step}단계 ${label}`
                    : `${step}단계 ${label} — 이전 단계를 먼저 마쳐야 한다`
                }
                onClick={() => onSelect(step)}
                className="
                  inline-flex items-center gap-[var(--spacing-2)]
                  rounded-[var(--radius-full)] border border-[var(--border-subtle)]
                  bg-[var(--surface-raised)] px-[var(--spacing-4)] py-[var(--spacing-2)]
                  text-sm text-[var(--text-secondary)]
                  transition-colors duration-[var(--duration-fast)]
                  hover:enabled:border-[var(--border-strong)]
                  disabled:cursor-not-allowed disabled:opacity-50
                  data-[state=current]:border-[var(--accent)]
                  data-[state=current]:bg-[var(--accent-soft)]
                  data-[state=current]:text-[var(--accent)]
                  data-[state=current]:font-semibold
                "
              >
                <span
                  aria-hidden="true"
                  className="
                    inline-flex h-[1.5rem] w-[1.5rem] items-center justify-center
                    rounded-[var(--radius-full)] bg-[var(--surface-sunken)] text-xs
                  "
                >
                  {step}
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
