import type { StatsResponse } from '../api/client'

/**
 * 5단계 마법사의 상태.
 *
 * 이 파일이 이렇게 조심스러운 이유는 원본 Streamlit 판에서 **확정 결함 6건이
 * 전부 상태 관리에서** 났기 때문이다.
 *
 * | 결함 | 무엇이 났나 |
 * |---|---|
 * | V04 | 사이드바가 리셋 플래그를 같은 run 에서 먼저 소비해 실제 리셋이 죽은 코드가 됐다 |
 * | V05 | 리셋이 원본 프레임을 지우지 않고 `None` 을 대입해 다음 렌더에서 TypeError |
 * | V06 | 리셋이 `max_step` 을 되돌리지 않아 잠겨야 할 단계가 열려 있었다 |
 * | V07 | 4단계를 벗어나면 위젯 상태가 지워져 GPT 서술 4개가 사라졌다 |
 * | V17 | 데이터를 다시 불러도 이전 파생 상태가 남아 A 의 차트가 B 화면에 보였다 |
 * | V19 | 조기 반환 경로가 `max_step` 갱신을 건너뛰었다 |
 *
 * 공통 원인은 하나다 — **상태를 바꾸는 길이 여러 개였고 서로 어긋났다.**
 * 그래서 여기서는 전이를 순수 리듀서 하나로 모은다. 리셋 경로가 셋이 될 수
 * 없고, "어떤 키를 지웠나" 를 기억할 필요도 없다. 리셋은 초기 상태를 새로
 * 만들어 돌려주는 것이지 키를 골라 지우는 것이 아니다.
 */

export const STEPS = [
  '데이터 설정',
  '통계 확인',
  '그래프 검토',
  'GPT 서술',
  '보고서 생성',
] as const

export type Step = 1 | 2 | 3 | 4 | 5

export const NARRATIVE_KEYS = ['trend', 'comparison', 'regional', 'yoy'] as const
export type NarrativeKey = (typeof NARRATIVE_KEYS)[number]

export type Narratives = Record<NarrativeKey, string>

export interface WizardState {
  /** 지금 보고 있는 단계. */
  readonly step: Step

  /**
   * 지금까지 도달한 최대 단계. 여기까지만 클릭으로 이동할 수 있다.
   *
   * 되돌아가도 줄지 않는다 — 3단계까지 갔다가 1단계로 와도 3단계는 열려 있어야
   * 한다. 반대로 **리셋하면 반드시 1 로 돌아간다**(V06).
   */
  readonly maxStep: Step

  /** 분석 대상. `null` 이면 아직 고르지 않았다. */
  readonly university: string | null
  readonly year: number | null
  /** 서버가 확정해 돌려준 권역. 클라이언트가 추측하지 않는다(V03). */
  readonly regionName: string | null

  /** 서버에서 받은 통계. 파생 상태의 뿌리다. */
  readonly stats: StatsResponse | null

  /**
   * GPT 서술 4종.
   *
   * **스토어가 들고 있는 것이 V07 의 해법이다.** Streamlit 은 text_area 위젯
   * 상태에 뒀는데, 4단계를 벗어난 run 에서 위젯이 사라지면 빈 문자열이 백업을
   * 덮어썼다. 스토어 값은 단계 이동과 무관하게 살아 있다.
   */
  readonly narratives: Narratives

  readonly loading: boolean
  readonly error: string | null
}

export type WizardAction =
  /** 단계 이동. `maxStep` 을 넘어서는 요청은 무시한다. */
  | { readonly type: 'goto'; readonly step: Step }
  /** 다음 단계로. 도달 범위를 한 칸 넓힌다. */
  | { readonly type: 'next' }
  /** 분석 대상 선택. 대상이 바뀌면 이전 통계는 의미가 없다. */
  | { readonly type: 'selectTarget'; readonly university: string; readonly year: number }
  | { readonly type: 'loadStart' }
  | { readonly type: 'loadSuccess'; readonly stats: StatsResponse }
  | { readonly type: 'loadFailure'; readonly error: string }
  /** 서술 편집. 사용자가 지운 것도 존중한다 — 빈 문자열은 유효한 값이다. */
  | { readonly type: 'setNarrative'; readonly key: NarrativeKey; readonly text: string }
  /** 전부 처음으로. **경로가 하나뿐이다**(V04·V05·V06). */
  | { readonly type: 'reset' }
