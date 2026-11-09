import { useId } from 'react'

import { byYear, type Averages, type RankChange, type TrendPoint } from '../../api/client'
import { cn } from '../../lib/cn'

export interface YearTableProps {
  readonly trend: Record<string, TrendPoint>
  readonly averages: Record<string, Averages>
  readonly rankChanges: Record<string, RankChange>
  readonly university: string
  readonly regionName: string
  /** 강조할 기준 연도. */
  readonly baseYear: number | null
}

/** 값이 없으면 0 이 아니라 '—' 다. 0.0000 은 "논문이 없다" 는 뜻이 되어버린다. */
function num(value: number | null | undefined, digits: number): string {
  return value == null ? '—' : value.toFixed(digits)
}

function rank(value: number | null | undefined): string {
  return value == null ? '—' : `${value}위`
}

/**
 * 연도별 상세 표.
 *
 * 원본 Streamlit 판은 2단계에서 `dataframe` 으로 연도별 수치를 **표로** 보여줬다.
 * 이관 후에는 차트의 `sr-only` 표만 남아, 눈으로 보는 사용자는 값을 짚어 읽을
 * 방법이 없었다 — 차트에서 0.5121 과 0.5118 을 구분할 수는 없다.
 *
 * 보고서에 들어갈 숫자를 확인하는 단계이므로, 표가 차트보다 중요하다.
 *
 * 표 스스로는 틀을 갖지 않는다 — 2단계가 이 표를 프레임(`Card`)에 넣어 제목과
 * 각주를 붙인다. 여기서 선과 그림자를 한 번 더 두르면 프레임 안의 프레임이다.
 * 머리글은 아이브로, 숫자는 모노(`--font-numeric`), 기준 행은 `--accent-soft`
 * 바탕에 왼쪽 3px 주홍 — 이 화면에서 주홍이 가리키는 두 곳 중 하나다.
 */
export function YearTable({
  trend,
  averages,
  rankChanges,
  university,
  regionName,
  baseYear,
}: YearTableProps) {
  const captionId = useId()
  const rows = byYear(trend)
  const avgByYear = new Map(byYear(averages).map((a) => [a.year, a]))
  const rankByYear = new Map(byYear(rankChanges).map((r) => [r.year, r]))

  if (rows.length === 0) {
    return <p className="m-0 text-body text-[var(--text-muted)]">표시할 연도가 없습니다.</p>
  }

  return (
    // 좁은 화면에서 표만 가로로 스크롤한다. 페이지 전체가 흔들리면 못 읽는다.
    // 스크롤 영역은 이름 있는 region 이고 포커스를 받는다 — 아니면 키보드
    // 사용자는 오른쪽 열을 못 본다. 표의 최소 폭을 두어 셀이 글자 단위로
    // 쪼개지는 대신 스크롤이 생기게 한다.
    <div
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
      className="overflow-x-auto"
    >
      <table
        data-testid="year-table"
        className="w-full min-w-[48rem] border-collapse text-body"
      >
        <caption id={captionId} className="sr-only">
          {university} 연도별 1인당 논문 수와 순위, {regionName}·전국 평균 비교
        </caption>
        <thead>
          <tr className="border-b border-[var(--border-strong)]">
            <Th scope="col">연도</Th>
            <Th scope="col" numeric>
              전임교원수
            </Th>
            <Th scope="col" numeric>
              논문수
            </Th>
            <Th scope="col" numeric>
              1인당논문수
            </Th>
            <Th scope="col" numeric>
              {regionName} 평균
            </Th>
            <Th scope="col" numeric>
              전국 평균
            </Th>
            <Th scope="col" numeric>
              권역순위
            </Th>
            <Th scope="col" numeric>
              전국순위
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const avg = avgByYear.get(r.year)
            const rk = rankByYear.get(r.year)
            const isBase = r.year === baseYear
            return (
              <tr
                key={r.year}
                aria-current={isBase ? 'true' : undefined}
                className={cn(
                  'border-b border-[var(--border-subtle)]',
                  isBase && 'bg-[var(--accent-soft)] font-semibold',
                )}
              >
                <Td scope="row" marked={isBase}>
                  {r.year}년
                </Td>
                <Td numeric>{r.faculty.toLocaleString('ko-KR')}</Td>
                <Td numeric>{num(r.papers, 0)}</Td>
                <Td numeric>{num(r.perCapita, 4)}</Td>
                <Td numeric>{num(avg?.regional, 4)}</Td>
                <Td numeric>{num(avg?.national, 4)}</Td>
                <Td numeric>{rank(rk?.regionalRank ?? r.regionalRank)}</Td>
                <Td numeric>{rank(rk?.nationalRank ?? r.nationalRank)}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 머리글 — 아이브로. 한국어 짧은 명사라 모노를 걸지 않는다(한글이 섞이면 글꼴이 갈라진다). */
function Th({
  children,
  numeric,
  scope,
}: {
  children: React.ReactNode
  numeric?: boolean
  scope: 'col' | 'row'
}) {
  return (
    <th
      scope={scope}
      className={cn(
        'eyebrow whitespace-nowrap px-[var(--spacing-3)] py-[var(--spacing-3)] text-[var(--text-secondary)]',
        numeric ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  numeric,
  scope,
  marked = false,
}: {
  children: React.ReactNode
  numeric?: boolean
  scope?: 'row'
  /** 기준 행의 첫 칸 — 왼쪽 3px 주홍 막대. 색을 못 보는 사람에게는 굵기(행)가 남는다. */
  marked?: boolean
}) {
  const className = cn(
    'whitespace-nowrap px-[var(--spacing-3)] py-[var(--spacing-2)] text-[var(--text-primary)]',
    // 숫자는 모노 + 같은 폭 글리프 — 자릿수가 맞아야 세로로 비교가 된다
    numeric ? 'font-[family-name:var(--font-numeric)] tabular text-right' : 'text-left',
  )
  return scope ? (
    // 행 머리(연도)는 "2026년" 처럼 한글이 붙어 본문 글꼴이다. 막대는 셀에 긋는다 —
    // border-collapse 에서 tr 의 좌우 선은 브라우저가 그리지 않는다.
    <th
      scope="row"
      className={cn(className, 'font-medium', marked && 'border-l-[3px] border-l-[var(--accent)]')}
    >
      {children}
    </th>
  ) : (
    <td className={className}>{children}</td>
  )
}
