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
 */
export function YearTable({
  trend,
  averages,
  rankChanges,
  university,
  regionName,
  baseYear,
}: YearTableProps) {
  const rows = byYear(trend)
  const avgByYear = new Map(byYear(averages).map((a) => [a.year, a]))
  const rankByYear = new Map(byYear(rankChanges).map((r) => [r.year, r]))

  if (rows.length === 0) {
    return <p className="m-0 text-sm text-[var(--text-muted)]">표시할 연도가 없다.</p>
  }

  return (
    // 좁은 화면에서 표만 가로로 스크롤한다. 페이지 전체가 흔들리면 못 읽는다.
    <div className="overflow-x-auto">
      <table
        data-testid="year-table"
        className="w-full border-collapse text-sm"
      >
        <caption className="sr-only">
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
                <Td scope="row">{r.year}년</Td>
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
        'px-[var(--spacing-3)] py-[var(--spacing-2)] font-medium text-[var(--text-secondary)]',
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
}: {
  children: React.ReactNode
  numeric?: boolean
  scope?: 'row'
}) {
  const className = cn(
    'px-[var(--spacing-3)] py-[var(--spacing-2)] text-[var(--text-primary)]',
    // 숫자는 자릿수가 맞아야 비교가 된다
    numeric ? 'tabular text-right' : 'text-left',
  )
  return scope ? (
    <th scope="row" className={cn(className, 'font-medium')}>
      {children}
    </th>
  ) : (
    <td className={className}>{children}</td>
  )
}
