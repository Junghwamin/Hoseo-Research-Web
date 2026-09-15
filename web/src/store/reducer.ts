import type { NarrativeKey, Narratives, Step, WizardAction, WizardState } from './types'
import { NARRATIVE_KEYS } from './types'

const MIN_STEP = 1
const MAX_STEP = 5

/** 서술 4종을 빈 문자열로 채운 새 객체. 매번 새로 만든다 — 공유하면 새어나간다. */
function emptyNarratives(): Narratives {
  return Object.fromEntries(NARRATIVE_KEYS.map((k) => [k, ''])) as Narratives
}

export const INITIAL_STATE: WizardState = {
  step: 1,
  maxStep: 1,
  university: null,
  year: null,
  regionChoice: null,
  compareGroup: null,
  years: null,
  regionName: null,
  stats: null,
  narratives: emptyNarratives(),
  loading: false,
  error: null,
}

function isStep(value: number): value is Step {
  return Number.isInteger(value) && value >= MIN_STEP && value <= MAX_STEP
}

/**
 * 데이터가 바뀌었을 때 버려야 하는 것들.
 *
 * V17 이 난 자리다. 무엇을 **남길지** 고르는 대신 무엇을 **버릴지** 한 곳에
 * 적는다. 남길 것을 고르면 새 필드가 생길 때마다 여기 추가하는 걸 잊고,
 * 잊힌 필드가 이전 분석의 잔재로 화면에 남는다.
 */
function clearDerived(state: WizardState): WizardState {
  return {
    ...state,
    stats: null,
    regionName: null,
    narratives: emptyNarratives(),
    // 파생 상태가 없는데 3단계에 갈 수 있으면 지워진 통계를 그리려다 터진다
    step: 1,
    maxStep: 1,
    error: null,
  }
}

/**
 * 마법사 상태 전이.
 *
 * **모든 전이가 여기를 지난다.** 원본 Streamlit 판의 결함 6건은 전부
 * "상태를 바꾸는 길이 여러 개였고 서로 어긋났다" 는 한 원인에서 나왔다.
 * 길이 하나면 어긋날 수 없다.
 */
export function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'goto': {
      // 도달하지 않은 단계로는 갈 수 없다. 범위 밖 값도 여기서 걸린다.
      if (!isStep(action.step) || action.step > state.maxStep) return state
      if (action.step === state.step) return state
      // maxStep 은 건드리지 않는다 — 뒤로 가도 열린 단계는 닫히지 않는다(V19).
      return { ...state, step: action.step }
    }

    case 'next': {
      if (state.step >= MAX_STEP) return state
      const step = (state.step + 1) as Step
      return {
        ...state,
        step,
        maxStep: (step > state.maxStep ? step : state.maxStep) as Step,
      }
    }

    case 'selectTarget': {
      // 대상이 바뀌면 이전 분석의 결과는 전부 의미가 없다(V17).
      //
      // 비교군도 여기 포함된다. 비교군이 바뀌면 평균·비교표·차트가 전부
      // 달라지고, 그것들을 근거로 쓴 GPT 서술도 더는 맞지 않는다.
      // "숫자만 갱신하고 글은 둔다" 는 절충은 **틀린 글을 남기는 쪽**이다.
      return {
        ...clearDerived(state),
        university: action.university,
        year: action.year,
        regionChoice: action.regionChoice ?? null,
        compareGroup: action.compareGroup ?? null,
        years: action.years ?? null,
      }
    }

    case 'loadStart':
      return { ...state, loading: true, error: null }

    case 'loadSuccess':
      return {
        ...state,
        loading: false,
        error: null,
        stats: action.stats,
        // 권역은 서버가 확정해 돌려준 값을 그대로 쓴다. 클라이언트가 추측하면
        // '권역평균' 이 엉뚱한 모집단을 가리킨다(V03).
        regionName: action.stats.regionName,
        // 비교군도 서버가 확정한 것으로 맞춘다. 사용자가 고르지 않았으면
        // 기본 비교군이 들어오는데, 이걸 반영하지 않으면 **차트 요청만
        // 비교군 없이 나가** 화면과 보고서의 그림이 갈라진다.
        compareGroup: action.stats.compareGroup,
        // 분석 연도도 같은 이유로 서버가 쓴 값으로 맞춘다. 고르지 않았으면
        // 전 연도가 들어온다.
        years: action.stats.years,
      }

    case 'loadFailure':
      // 실패했는데 옛 숫자가 남아 있으면 성공한 것처럼 보인다.
      return { ...state, loading: false, error: action.error, stats: null }

    case 'setNarrative': {
      const key: NarrativeKey = action.key
      if (state.narratives[key] === action.text) return state
      // 빈 문자열도 유효한 값이다 — 사용자가 지운 것을 되살리지 않는다(V07).
      return { ...state, narratives: { ...state.narratives, [key]: action.text } }
    }

    case 'reset':
      // 키를 골라 지우지 않는다. 고르는 순간 빠뜨린다(V04·V05·V06).
      return { ...INITIAL_STATE, narratives: emptyNarratives() }

    default:
      return state
  }
}
