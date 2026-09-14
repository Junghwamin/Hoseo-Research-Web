import { useEffect, useState } from 'react'

import {
  api,
  ApiError,
  type DatasetInfo,
  type UniversityRow,
} from '../../api/client'

/** 요청 하나의 상태. 세 값을 따로 들고 다니면 조합이 어긋난다. */
export interface Async<T> {
  readonly data: T | null
  readonly loading: boolean
  readonly error: string | null
}

const IDLE = { data: null, loading: false, error: null } as const

function message(e: unknown): string {
  return e instanceof ApiError ? e.detail : String(e)
}

/**
 * 조건이 갖춰졌을 때만 한 번 불러오는 훅.
 *
 * `key` 가 null 이면 아무것도 하지 않는다 — "대학을 아직 안 골랐으니 권역도
 * 모른다" 같은 상태를 `if` 로 흩어 두지 않기 위해서다.
 *
 * 취소 플래그가 있는 이유: 사용자가 빠르게 대상을 바꾸면 **먼저 보낸 요청이
 * 나중에 도착**할 수 있다. 그러면 새 대상 화면에 옛 대상의 목록이 뜬다
 * (V17 과 같은 모양의 사고다).
 */
function useAsync<T>(key: string | null, fetcher: () => Promise<T>): Async<T> {
  const [state, setState] = useState<Async<T>>(IDLE)

  useEffect(() => {
    if (key === null) {
      setState(IDLE)
      return
    }
    let alive = true
    setState({ data: null, loading: true, error: null })
    fetcher()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e) => alive && setState({ data: null, loading: false, error: message(e) }))
    return () => {
      alive = false
    }
    // fetcher 는 매 렌더 새로 만들어지므로 의존성에 넣지 않는다. key 가
    // 요청을 결정한다 — key 가 같으면 같은 요청이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

/** 데이터셋 정보. 앱 수명 동안 한 번만 바뀐다. */
export function useDataset(): Async<DatasetInfo> {
  return useAsync('dataset', () => api.dataset())
}

/**
 * 이 대학이 걸쳐 있는 권역 목록.
 *
 * 대부분 하나지만, 다캠퍼스 대학(경동대·단국대·상명대·예원예술대·을지대·
 * 홍익대)은 둘 이상이다. 원본 Streamlit 판은 그 경우에만 선택 위젯을 띄웠다.
 * 이관 후에는 엔드포인트만 남고 부르는 곳이 없어서, 홍익대를 고르면 서버가
 * 정한 권역으로 **조용히** 분석됐다.
 */
export function useUniversityRegions(university: string | null): Async<string[]> {
  const state = useAsync(university, () => api.regions(university!).then((r) => r.regions))
  return state
}

/** 권역 안의 대학 전체. 비교군 후보다. */
export function useRegionUniversities(
  region: string | null,
  year: number | null,
): Async<UniversityRow[]> {
  const key = region && year ? `${region}:${year}` : null
  return useAsync(key, () => api.universities(region!, year!).then((r) => r.rows))
}
