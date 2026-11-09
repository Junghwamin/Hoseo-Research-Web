import { useEffect, useRef } from 'react'

import type { DatasetInfo } from '../../api/client'
import { ContextBar } from '../../components/ContextBar'
import { StepNav } from '../../components/StepNav'
import { Button } from '../../design/ui'
import { useWizard } from '../../store/WizardProvider'
import type { Step } from '../../store/types'
import type { Reloadable } from './hooks'
import { LAST_STEP, stepAt } from './steps/registry'
import type { StepActions } from './steps/types'

export interface WizardShellProps {
  /**
   * `/api/data`. App 이 들고 내려준다 — 히어로의 자료 현황과 여기가 같은 응답을
   * 봐야 하고, 두 번 받을 이유가 없다.
   */
  readonly dataset: Reloadable<DatasetInfo>
}

const BLOCKED_ID = 'wizard-next-blocked'

/**
 * 마법사 껍데기.
 *
 * **단계에 대해 아무것도 모른다.** 무엇을 그릴지, 언제 넘어갈 수 있는지는
 * 전부 `steps/registry.ts` 에서 읽는다. 그래서 단계를 추가하거나 순서를
 * 바꾸는 일이 이 파일을 건드리지 않는다.
 *
 * 단계가 바뀌면 제목(h2)으로 포커스를 옮긴다. 안 그러면 「다음」을 누른 키보드
 * 사용자의 포커스가 사라진 버튼 자리에 남고, 스크린리더는 바뀐 것을 모른다.
 * 첫 마운트에서는 옮기지 않는다 — 페이지가 뜨자마자 포커스를 훔치지 않는다.
 */
export function WizardShell({ dataset }: WizardShellProps) {
  const wizard = useWizard()
  const { state } = wizard
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(state.step)

  useEffect(() => {
    if (previousStep.current === state.step) return
    previousStep.current = state.step
    headingRef.current?.focus()
  }, [state.step])

  const current = stepAt(state.step)
  if (!current) {
    // registry 와 상태가 어긋난 경우. 조용히 빈 화면을 주면 원인을 못 찾는다.
    throw new Error(`정의되지 않은 단계: ${state.step}`)
  }
  const next = stepAt(state.step + 1)

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

      {/* 2단계부터: 지금 무엇을 보고 있는지 한 줄로 따라온다. 1단계에서는 바로
          아래 폼이 같은 내용이라 두지 않는다. */}
      {state.stats && state.step > 1 && (
        <ContextBar stats={state.stats} onChange={() => wizard.goto(1)} />
      )}

      <header className="flex flex-col gap-[var(--spacing-2)]">
        {/* 단계 제목은 Pretendard 700 — 홈 h1 과 같은 글꼴, 한 단 작은 크기. */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="m-0 text-title font-bold text-[var(--text-primary)] outline-none"
        >
          {current.title}
        </h2>
        <p className="m-0 max-w-[var(--container-prose)] text-lead text-[var(--text-secondary)]">
          {current.description}
        </p>
      </header>

      {(state.error || dataset.error) && (
        <div
          role="alert"
          data-testid="api-error"
          className="
            flex flex-wrap items-center justify-between gap-[var(--spacing-3)]
            border border-[var(--color-down)]
            bg-[var(--color-down-soft)] p-[var(--spacing-4)]
            text-body text-[var(--color-down)]
          "
        >
          <p className="m-0">데이터를 불러오지 못했습니다. {state.error ?? dataset.error}</p>
          {/* 콜드 스타트 중 첫 요청이 죽으면 여기서 멈춘다. 새로고침 말고 길을 준다. */}
          {dataset.error && (
            <Button size="sm" onClick={dataset.reload}>
              다시 시도
            </Button>
          )}
        </div>
      )}

      <current.Component state={state} dataset={dataset.data} actions={actions} />

      {/* 휴대폰에서는 바닥에 붙는다 — 긴 표 아래까지 내려가서 「다음」을 찾지
          않게. 큰 화면에서는 본문 끝의 보통 줄이다. */}
      <nav
        aria-label="단계 이동"
        className="
          sticky bottom-0 z-10 -mx-[var(--spacing-5)] flex min-h-[var(--actionbar-h)]
          flex-wrap items-center gap-[var(--spacing-3)] border-t
          border-[var(--border-subtle)] bg-[var(--surface-base)]
          px-[var(--spacing-5)] py-[var(--spacing-3)]
          pb-[max(var(--spacing-3),env(safe-area-inset-bottom))]
          md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0 md:pt-[var(--spacing-5)]
        "
      >
        <Button
          variant="danger"
          className="mr-auto"
          data-testid="reset-button"
          onClick={wizard.reset}
        >
          <span className="hidden sm:inline">처음부터 다시</span>
          <span className="sm:hidden">초기화</span>
        </Button>

        {state.step > 1 && (
          <Button
            data-testid="prev-button"
            onClick={() => wizard.goto((state.step - 1) as Step)}
          >
            이전
          </Button>
        )}

        {!isLast && (
          <>
            <Button
              variant="primary"
              data-testid="next-button"
              disabled={blocked !== null}
              aria-describedby={blocked ? BLOCKED_ID : undefined}
              onClick={wizard.next}
            >
              {`다음: ${next?.title ?? ''}`}
            </Button>
            {/* 왜 못 누르는지 **말한다.** 회색으로 죽어 있기만 한 버튼이
                사용자가 "불편하다" 고 한 것 중 하나였다. */}
            {blocked && (
              <span
                id={BLOCKED_ID}
                className="basis-full text-body text-[var(--text-muted)] md:basis-auto"
              >
                {blocked}
              </span>
            )}
          </>
        )}
      </nav>
    </div>
  )
}
