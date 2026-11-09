import { Step1Target } from './Step1Target'
import { Step2Metrics } from './Step2Metrics'
import { Step3Charts } from './Step3Charts'
import { Step4Narrative } from './Step4Narrative'
import { Step5Report } from './Step5Report'
import type { StepDefinition } from './types'

/**
 * 단계 목록 — **단계에 관한 모든 것이 여기서 파생된다.**
 *
 * 진행 표시, 이동 버튼, 잠금 규칙, 화면 제목이 전부 이 배열을 읽는다.
 * 그래서 단계를 추가·삭제·재정렬하는 일이 이 파일 한 곳으로 끝난다.
 *
 * 규칙 두 가지.
 *
 * 1. **`id` 는 화면 순서이자 잠금 순서다.** 배열 순서와 같아야 한다 —
 *    아래 `assertOrdered` 가 확인한다.
 * 2. **단계 컴포넌트는 형제를 모른다.** `StepProps` 만 받는다. 옆 단계를
 *    직접 부르기 시작하면 순서를 바꿀 수 없게 된다.
 *
 * 설명은 결과를 말한다 — "무엇을 고른다" 가 아니라 "고르면 무엇이 정해진다"(DESIGN.md §8).
 */
export const STEP_REGISTRY: readonly StepDefinition[] = [
  {
    id: 1,
    title: '데이터 설정',
    description: '대학과 기준 연도를 고르면 권역과 비교군이 정해집니다. 비교군은 직접 바꿀 수 있습니다.',
    Component: Step1Target,
    blockedReason: (s) => (s.stats ? null : '분석을 먼저 불러오세요'),
  },
  {
    id: 2,
    title: '통계 확인',
    description: '보고서에 실리는 숫자입니다. 순위 변화는 양수가 개선, 음수가 하락입니다.',
    Component: Step2Metrics,
  },
  {
    id: 3,
    title: '그래프 검토',
    description: '차트 5장이 이 모습 그대로 Word 에 들어갑니다.',
    Component: Step3Charts,
  },
  {
    id: 4,
    title: 'GPT 서술',
    description: '절마다 GPT 초안을 만들고 직접 다듬습니다. 다른 단계에 다녀와도 글은 남아 있습니다.',
    Component: Step4Narrative,
  },
  {
    id: 5,
    title: '보고서 생성',
    description: '아래 내용이 그대로 문서가 됩니다. 고칠 곳이 있으면 「변경」으로 돌아갑니다.',
    Component: Step5Report,
  },
] as const

/**
 * 배열 순서와 `id` 가 어긋나지 않게 한다.
 *
 * 어긋나면 3단계 버튼이 4단계를 여는 식으로 조용히 틀어진다 — 화면은
 * 멀쩡해 보이고 눌러 봐야 안다. 모듈 로드 때 바로 터뜨린다.
 */
function assertOrdered(steps: readonly StepDefinition[]): void {
  steps.forEach((step, i) => {
    if (step.id !== i + 1) {
      throw new Error(
        `STEP_REGISTRY 순서가 어긋났다: ${i} 번째 항목의 id 가 ${step.id} 다 (${i + 1} 이어야 한다)`,
      )
    }
  })
}

assertOrdered(STEP_REGISTRY)

export function stepAt(id: number): StepDefinition | undefined {
  return STEP_REGISTRY.find((s) => s.id === id)
}

export const LAST_STEP = STEP_REGISTRY[STEP_REGISTRY.length - 1].id
