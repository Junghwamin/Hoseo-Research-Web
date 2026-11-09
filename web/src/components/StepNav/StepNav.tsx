import { cn } from '../../lib/cn'
import { STEPS, type Step } from '../../store/types'

export interface StepNavProps {
  readonly current: Step
  /** 여기까지만 클릭할 수 있다. */
  readonly maxStep: Step
  readonly onSelect: (step: Step) => void
}

type StepState = 'current' | 'reached' | 'locked'

/** "01" — 번호는 두 자리 모노다(DESIGN.md §6). */
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 5단계 진행 표시 겸 이동 — "01 데이터 설정" 밑줄 탭.
 *
 * 도달하지 않은 단계는 `disabled` 로 둔다 — 여기서는 "있는데 안 되는 기능" 이
 * 아니라 **진행 상태의 표현**이라 보여주는 것이 맞다. 미구현 모듈을 숨기는
 * 규칙(§6)과 다른 경우다. 다만 왜 못 누르는지는 음성으로 알려야 한다.
 *
 * 잠긴 단계를 흐리게(opacity) 하지 않는다. 투명도는 바탕에 따라 대비가 무너지고,
 * 회색 글자 토큰은 어느 바탕에서든 대비를 지킨다. 현재 단계는 잉크 글자 + 주홍
 * 2px 밑줄 — 1단계 화면에서 주홍이 쓰이는 두 자리 중 하나다(나머지는 기준 연도).
 *
 * 휴대폰(<768px)에서는 탭 다섯 개가 들어가지 않는다. 라벨은 CSS 로만 감추고
 * 44px 사각 점 다섯 개를 남기며, 그 위에 "01 / 05 · 이름" 한 줄을 둔다. 라벨
 * 텍스트 노드는 **한 번만** 있다 — 보조 기술이 같은 이름을 두 번 읽지 않게.
 * 요약 줄은 한글이 섞인 한 문장이라 모노를 걸지 않는다(글꼴이 갈라진다).
 */
export function StepNav({ current, maxStep, onSelect }: StepNavProps) {
  return (
    <nav aria-label="분석 단계" className="border-b border-[var(--border-subtle)]">
      <p
        aria-hidden="true"
        className="m-0 pb-[var(--spacing-2)] text-body font-semibold text-[var(--text-primary)] md:hidden"
      >
        {`${pad(current)} / ${pad(STEPS.length)} · ${STEPS[current - 1]}`}
      </p>

      <ol className="m-0 flex list-none gap-[var(--spacing-1)] p-0 md:grid md:grid-cols-5 md:gap-0">
        {STEPS.map((label, i) => {
          const step = (i + 1) as Step
          const reached = step <= maxStep
          const state: StepState = step === current ? 'current' : reached ? 'reached' : 'locked'

          return (
            <li key={label}>
              <button
                type="button"
                data-testid={`step-${step}`}
                data-state={state}
                disabled={!reached}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={
                  reached
                    ? `${step}단계 ${label}`
                    : `${step}단계 ${label} — 이전 단계를 먼저 마치세요`
                }
                onClick={() => onSelect(step)}
                className={cn(
                  `flex h-[2.75rem] w-[2.75rem] items-center justify-center
                   text-body transition-colors duration-[var(--duration-fast)]
                   md:-mb-px md:h-auto md:w-full md:items-baseline md:justify-start
                   md:gap-[var(--spacing-2)] md:border-b-2
                   md:py-[var(--spacing-3)] md:pr-[var(--spacing-3)]`,
                  state === 'current' &&
                    'font-semibold text-[var(--text-primary)] md:border-[var(--accent)]',
                  state === 'reached' &&
                    'text-[var(--text-secondary)] hover:text-[var(--text-primary)] md:border-transparent',
                  state === 'locked' &&
                    'cursor-not-allowed text-[var(--text-muted)] md:border-transparent',
                )}
              >
                {/* 휴대폰용 8px 사각 점. 큰 화면에서는 번호와 글자가 대신한다. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-[0.5rem] w-[0.5rem] rounded-none md:hidden',
                    state === 'current' && 'bg-[var(--accent)]',
                    state === 'reached' && 'bg-[var(--border-strong)]',
                    state === 'locked' && 'bg-[var(--border-subtle)]',
                  )}
                />
                <span className="eyebrow-mono hidden md:inline">{pad(step)}</span>
                <span className="hidden md:inline">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
