import type { ReactNode } from 'react'

import type { DatasetInfo } from '../../../api/client'
import type { Step, WizardState } from '../../../store/types'
import type { AnalysisInput } from '../../../store/WizardProvider'

/**
 * 단계 하나가 받는 것 전부.
 *
 * 단계 컴포넌트는 **이것 말고 아무것도 모른다.** 형제 단계도, 자기가 몇
 * 번째인지도 모른다. 그래서 단계를 넣고 빼고 순서를 바꾸는 일이
 * `registry.ts` 한 줄이 된다.
 */
export interface StepProps {
  readonly state: WizardState
  /** 데이터셋 정보(연도·권역·대학 목록). 아직 못 받았으면 null. */
  readonly dataset: DatasetInfo | null
  readonly actions: StepActions
}

export interface StepActions {
  readonly goto: (step: Step) => void
  readonly next: () => void
  readonly reset: () => void
  readonly setNarrative: (key: string, text: string) => void
  readonly loadTarget: (input: AnalysisInput) => Promise<void>
}

/**
 * 단계 정의.
 *
 * 단계를 **추가**하려면: 컴포넌트 파일 하나를 만들고 `registry.ts` 에 항목
 * 하나를 넣는다. 그 외에 손댈 곳이 없다 — 진행 표시·이동 버튼·잠금 규칙이
 * 전부 이 배열에서 파생된다.
 */
export interface StepDefinition {
  readonly id: Step
  /** 진행 표시에 쓰는 짧은 이름. */
  readonly title: string
  /** 화면 상단의 작은 라벨. */
  readonly eyebrow: string
  /** 이 단계에서 무엇을 하는지 한 줄. */
  readonly description: string
  readonly Component: (props: StepProps) => ReactNode
  /**
   * 다음으로 넘어갈 수 있는가.
   *
   * 넘어갈 수 **없으면 이유를 문자열로** 돌려준다. `false` 를 돌려주는 방식은
   * 버튼이 회색으로 죽어 있는데 왜인지 알 수 없는 화면을 만든다 — 그게
   * 사용자가 "불편하다" 고 한 것 중 하나였다.
   */
  readonly blockedReason?: (state: WizardState) => string | null
}
