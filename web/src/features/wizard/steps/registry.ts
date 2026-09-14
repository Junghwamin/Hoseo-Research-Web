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
 */
export const STEP_REGISTRY: readonly StepDefinition[] = [
  {
    id: 1,
    title: '데이터 설정',
    eyebrow: '1단계',
    description: '분석할 대학과 연도를 고르고, 비교군을 정한다.',
    Component: Step1Target,
    blockedReason: (s) => (s.stats ? null : '먼저 분석을 불러와야 한다'),
  },
  {
    id: 2,
    title: '통계 확인',
    eyebrow: '2단계',
    description: '순위와 1인당 논문 수를 확인한다. 보고서에 실릴 숫자다.',
    Component: Step2Metrics,
  },
  {
    id: 3,
    title: '그래프 검토',
    eyebrow: '3단계',
    description: '문서에 들어갈 차트 5종을 미리 본다.',
    Component: Step3Charts,
  },
  {
    id: 4,
    title: 'GPT 서술',
    eyebrow: '4단계',
    description: '절마다 초안을 만들고 직접 고친다. 단계를 오가도 사라지지 않는다.',
    Component: Step4Narrative,
  },
  {
    id: 5,
    title: '보고서 생성',
    eyebrow: '5단계',
    description: '확인한 그대로 Word 파일을 만든다.',
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
