import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'

import { api, ApiError } from '../api/client'
import { INITIAL_STATE, reducer } from './reducer'
import type { NarrativeKey, Step, WizardState } from './types'

/** 한 번의 분석을 결정하는 입력 전부. */
export interface AnalysisInput {
  readonly university: string
  readonly year: number
  /** 다캠퍼스 대학에서 고른 권역. `null` 이면 서버가 판정한다. */
  readonly regionChoice?: string | null
  /** 고른 비교군. `null` 이면 서버 기본 비교군. */
  readonly compareGroup?: readonly string[] | null
}

interface WizardApi {
  readonly state: WizardState
  readonly goto: (step: Step) => void
  readonly next: () => void
  readonly reset: () => void
  readonly setNarrative: (key: NarrativeKey, text: string) => void
  /** 대상을 고르고 서버에서 통계를 받아온다. 실패는 상태의 error 로 들어간다. */
  readonly loadTarget: (input: AnalysisInput) => Promise<void>
}

const WizardContext = createContext<WizardApi | null>(null)

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const loadTarget = useCallback(async (input: AnalysisInput) => {
    const { university, year, regionChoice = null, compareGroup = null } = input

    // selectTarget 이 먼저 파생 상태를 지운다. 순서를 바꾸면 요청이 실패했을 때
    // 이전 분석 결과가 그대로 남아 새 대상의 것처럼 보인다(V17).
    dispatch({ type: 'selectTarget', university, year, regionChoice, compareGroup })
    dispatch({ type: 'loadStart' })
    try {
      const stats = await api.stats({
        university,
        year,
        regionName: regionChoice,
        // 빈 배열을 보내면 서버가 기본 비교군으로 되돌린다. "아무도 안 고름" 을
        // 표현할 방법이 없으므로, 비었으면 아예 보내지 않는다.
        compareGroup: compareGroup && compareGroup.length > 0 ? [...compareGroup] : null,
      })
      dispatch({ type: 'loadSuccess', stats })
    } catch (e) {
      dispatch({
        type: 'loadFailure',
        error: e instanceof ApiError ? e.detail : String(e),
      })
    }
  }, [])

  const value = useMemo<WizardApi>(
    () => ({
      state,
      goto: (step) => dispatch({ type: 'goto', step }),
      next: () => dispatch({ type: 'next' }),
      reset: () => dispatch({ type: 'reset' }),
      setNarrative: (key, text) => dispatch({ type: 'setNarrative', key, text }),
      loadTarget,
    }),
    [state, loadTarget],
  )

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}

export function useWizard(): WizardApi {
  const ctx = useContext(WizardContext)
  if (!ctx) {
    // Provider 밖에서 쓰면 조용히 기본값으로 도는 대신 즉시 터뜨린다 —
    // 조용한 기본값은 "왜 상태가 안 바뀌지" 를 한참 쫓게 만든다.
    throw new Error('useWizard 는 WizardProvider 안에서만 쓸 수 있다')
  }
  return ctx
}
