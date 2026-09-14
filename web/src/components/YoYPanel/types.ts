/**
 * 전년 대비 증감 패널 계약.
 *
 * 이 파일이 존재하는 이유는 확정 결함 두 건이다.
 *
 * - R-RS-03: Streamlit 판은 안내 문구를 `{기준연도} → {비교연도}` 로 찍었다.
 *   기준연도가 **최신**이고 비교연도가 **이전**이라 화면에는 "2026 → 2025" 처럼
 *   시간이 거꾸로 흐르는 문장이 남았다. 그래서 이 계약은 두 해를 각각 이름으로
 *   받고(`baseYear`/`compareYear`), 렌더 순서를 타입이 아니라 규칙으로 못박는다.
 *   **표시는 언제나 비교연도 → 기준연도(과거 → 현재)다.**
 *
 * - V12: 이전값이 0 이면 증감률을 낼 수 없다. 서버는 이때 `changeRate: null` 을
 *   보낸다. null 을 0 으로 접으면 신규 실적이 "변화 없음" 으로 둔갑한다.
 *   그래서 `changeRate` 는 `number | null` 이고, null 은 별도의 방향값을 갖는다.
 *
 * API 타입(`api/client.ts`)을 가져다 쓰지 않는 이유: 컴포넌트는 서버 스키마가
 * 아니라 자기 화면 계약을 갖는다. 서버가 필드를 옵셔널로 풀어도 이 패널의
 * 렌더 규칙은 흔들리지 않아야 한다.
 */

/**
 * 증감 방향. **숫자의 부호가 아니라 화면에 그릴 의미다.**
 *
 * `new` 가 따로 있는 이유가 V12 다. null 을 `flat` 에 합치면 "증가도 감소도
 * 아님" 이 되어, 없던 실적이 생긴 것과 그대로인 것이 같은 칸에 들어간다.
 */
export type YoYDirection = 'up' | 'down' | 'flat' | 'new'

/** 전년 대비 증감 한 건. */
export interface YoYEntry {
  /** 대학명. 한글 대학명은 길고, 꺾쇠 같은 문자가 섞여 들어와도 텍스트로만 다룬다. */
  readonly name: string

  /**
   * 증감률(%). **`null` 은 "계산 불가"이고 `0` 과 다르다.**
   *
   * 이전값이 0 이면 나눌 수가 없어 서버가 null 을 보낸다. 이 값을 0 으로
   * 채우는 순간 V12 가 재현된다 — 화면에 "+0.0%" 가 찍히고, 새로 생긴 실적이
   * 변화 없음으로 읽힌다.
   *
   * 필드가 아예 없는 경우(`undefined`)도 null 과 똑같이 다룬다. 서버 스키마가
   * 이 필드를 옵셔널로 두고 있어, 둘을 다르게 취급하면 언젠가 `undefined` 가
   * 산술로 흘러들어 `NaN%` 가 찍힌다.
   */
  readonly changeRate?: number | null

  /** 기준연도(= 최신 연도)의 1인당논문수. */
  readonly baseValue: number

  /** 비교연도(= 이전 연도)의 1인당논문수. 화면에서는 이 값이 **먼저** 온다. */
  readonly compareValue: number
}

export interface YoYChanges {
  /**
   * 증가 상위. 서버 스키마가 옵셔널이라 여기서도 옵셔널이다.
   *
   * 호출부마다 `?? []` 를 붙이게 만들지 않는다 — 그 방어는 반드시 한 군데에서
   * 빠지고, 빠진 곳에서 `undefined.length` 로 터진다. 없음을 빈 목록으로 읽는
   * 것은 이 컴포넌트가 안다.
   */
  readonly top?: readonly YoYEntry[]

  /** 감소 하위. `top` 과 같은 이유로 옵셔널이다. */
  readonly bottom?: readonly YoYEntry[]

  /**
   * 분석 대상 대학. 비교군에 대상이 없거나 전년도 데이터가 없으면 `null` 이다.
   * null 이어도 패널 전체가 무너지지 않아야 한다.
   */
  readonly target?: YoYEntry | null
}

export interface YoYPanelProps {
  readonly changes: YoYChanges

  /** 기준연도(= 현재·최신 연도). 예: `2026` */
  readonly baseYear: number

  /** 비교연도(= 이전 연도). 예: `2025` */
  readonly compareYear: number

  /** 데이터 로딩 중이면 스켈레톤을 그린다. */
  readonly loading?: boolean
}
