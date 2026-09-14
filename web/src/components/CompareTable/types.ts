/**
 * 비교군 대학 비교표 계약.
 *
 * 표가 하는 일은 **그리기뿐이다.** 정렬도 순위 계산도 하지 않는다.
 * 서버(`get_compare_group_data`)가 이미 1인당논문수 내림차순으로 정렬해서
 * 주기 때문에, 표가 한 번 더 정렬하면 두 곳이 서로 다른 규칙을 갖게 되고
 * 언젠가 어긋난다. 받은 순서를 그대로 그린다.
 *
 * 숫자 포맷도 도메인 규칙이라 `transform.ts` 로 빼두었다 — 자릿수가 화면마다
 * 달라지면 같은 값이 다른 값처럼 보인다.
 */

export interface CompareRow {
  /** 학교명. 표의 행 머리(`th scope=row`)가 된다. */
  readonly name: string

  /** 전임교원수. 천단위를 끊어 `931명` 으로 그린다. */
  readonly faculty: number

  /**
   * SCI/SCOPUS 논문수. 소수가 있는 이유는 공저 논문을 지분으로 나눠 세기
   * 때문이다(368.7722편). 화면에는 소수 1자리로 줄인다.
   */
  readonly papers: number

  /** 1인당논문수. 대학 간 차이가 소수 넷째 자리에서 갈려 4자리를 유지한다. */
  readonly perCapita: number

  /**
   * 전국순위. `null` 은 "순위 없음" 이고 **`0` 과 다르다.**
   * 결측을 0 으로 적으면 "전국 0위" 라는 없는 등수가 생긴다.
   */
  readonly nationalRank: number | null

  /**
   * 권역순위. 권역 밖 대학이면 `null` 이다 — 서버가
   * `reg_rank_map.get(name)` 으로 채우기 때문에 비교군에 타 권역 대학이
   * 섞이면 실제로 비어서 온다.
   *
   * 계약상 타입은 `number | null` 이지만 렌더러는 `undefined` 도 결측으로
   * 받아준다. OpenAPI 스키마가 이 필드를 optional(`regionalRank?`)로
   * 내보내기 때문에, 서버 응답을 그대로 넘기면 키 자체가 없을 수 있다.
   */
  readonly regionalRank: number | null
}

export interface CompareTableProps {
  /** 그릴 행들. 빈 배열이면 "표시할 데이터가 없다" 안내를 낸다. */
  readonly rows: readonly CompareRow[]

  /**
   * 표의 이름. `caption` 요소로 그리고 가로 스크롤 영역의 이름으로도 쓴다.
   *
   * 선택 항목으로 두지 않은 이유: 이름 없는 표는 스크린리더의 표 목록에서
   * "표"로만 보인다. 비교표가 여러 해·여러 권역으로 늘어나면 구분이 불가능해진다.
   */
  readonly caption: string

  /**
   * 강조할 대학명(분석 대상). `rows` 에 없는 이름이면 아무 행도 강조하지
   * 않는다 — 대상 대학이 비교군에서 빠진 해에도 표는 그려져야 한다.
   *
   * 이름이 정확히 같은 행만 강조한다. 공백을 다듬거나 부분 일치를 허용하면
   * "한국대학교" 가 "한국대학교세종캠퍼스" 까지 물고 들어간다.
   */
  readonly highlightName?: string

  /** 로딩 중이면 스켈레톤을 그린다. 행 내용보다 우선한다. */
  readonly loading?: boolean
}
