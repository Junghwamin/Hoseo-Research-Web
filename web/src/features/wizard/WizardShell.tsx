import { StepNav } from '../../components/StepNav'
import { Button } from '../../design/ui'
import { useWizard } from '../../store/WizardProvider'
import type { Step } from '../../store/types'
import { useDataset } from './hooks'
import { LAST_STEP, stepAt } from './steps/registry'
import type { StepActions } from './steps/types'

/**
 * 마법사 껍데기.
 *
 * **단계에 대해 아무것도 모른다.** 무엇을 그릴지, 언제 넘어갈 수 있는지는
 * 전부 `steps/registry.ts` 에서 읽는다. 그래서 단계를 추가하거나 순서를
 * 바꾸는 일이 이 파일을 건드리지 않는다.
 */
export function WizardShell() {
  const wizard = useWizard()
  const { state } = wizard
  const dataset = useDataset()

  const current = stepAt(state.step)
  if (!current) {
    // registry 와 상태가 어긋난 경우. 조용히 빈 화면을 주면 원인을 못 찾는다.
    throw new Error(`정의되지 않은 단계: ${state.step}`)
  }

  const actions: StepActions = {
    goto: wizard.goto,
    next: wizard.next,
    reset: wizard.reset,
    // 스토어는 NarrativeKey 만 받는다. 서버 응답 키는 string 이라 여기서
    // 좁힌다 — 모르는 키가 와도 조용히 버린다.
    setNarrative: (key, text) => wizard.setNarrative(key as never, text),
    loadTarget: wizard.loadTarget,
  }

  const blocked = current.blockedReason?.(state) ?? null
  const isLast = state.step === LAST_STEP

  return (
    <div className="flex flex-col gap-[var(--spacing-6)]">
      <StepNav current={state.step} maxStep={state.maxStep} onSelect={wizard.goto} />

      <header className="flex flex-col gap-[var(--spacing-2)]">
        <span className="text-eyebrow font-semibold uppercase text-[var(--accent)]">
          {current.eyebrow}
        </span>
        <h2 className="m-0 text-title font-bold text-[var(--text-primary)]">
          {current.title}
        </h2>
        <p className="m-0 max-w-[var(--container-prose)] text-lead text-[var(--text-secondary)]">
          {current.description}
        </p>
      </header>

      {(state.error || dataset.error) && (
        <p
          role="alert"
          data-testid="api-error"
          className="
            m-0 rounded-[var(--radius-md)] border border-[var(--color-down)]
            bg-[var(--color-down-soft)] p-[var(--spacing-4)]
            text-sm text-[var(--color-down)]
          "
        >
          데이터를 불러오지 못했다: {state.error ?? dataset.error}
        </p>
      )}

      <current.Component state={state} dataset={dataset.data} actions={actions} />

      <nav
        aria-label="단계 이동"
        className="
          flex flex-wrap items-center gap-[var(--spacing-3)]
          border-t border-[var(--border-subtle)] pt-[var(--spacing-5)]
        "
      >
        {state.step > 1 && (
          <Button
            data-testid="prev-button"
            onClick={() => wizard.goto((state.step - 1) as Step)}
          >
            ← 이전
          </Button>
        )}

        {!isLast && (
          <>
            <Button
              variant="primary"
              data-testid="next-button"
              disabled={blocked !== null}
              onClick={wizard.next}
            >
              다음 →
            </Button>
            {/* 왜 못 누르는지 **말한다.** 회색으로 죽어 있기만 한 버튼이
                사용자가 "불편하다" 고 한 것 중 하나였다. */}
            {blocked && (
              <span className="text-sm text-[var(--text-muted)]">{blocked}</span>
            )}
          </>
        )}

        <Button
          variant="danger"
          className="ml-auto"
          data-testid="reset-button"
          onClick={wizard.reset}
        >
          처음부터 다시
        </Button>
      </nav>

      {dataset.data && (
        <p className="m-0 text-xs text-[var(--text-muted)]">
          {dataset.data.nationalRankScopeNote}
        </p>
      )}
    </div>
  )
}
