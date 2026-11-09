import { useId } from 'react'

import { cn } from '../../lib/cn'
import {
  formatFaculty,
  formatPapers,
  formatPerCapita,
  formatRank,
} from './transform'
import type { CompareTableProps } from './types'

/** 숫자 열 머리. 학교명만 성격이 달라 따로 그린다. */
const NUMERIC_COLUMNS = [
  '전임교원수',
  '논문수',
  '1인당논문수',
  '전국순위',
  '권역순위',
] as const

/**
 * 머리글 칸 — 아이브로. 한국어 짧은 명사라 모노를 걸지 않는다(한글이 섞이면
 * 글꼴이 갈라진다). 아래 1px 굵은 선은 머리글 행(`thead tr`)이 긋는다.
 */
const HEADER_CELL =
  'eyebrow whitespace-nowrap px-[var(--spacing-4)] py-[var(--spacing-3)] text-[var(--text-secondary)]'

/**
 * 숫자 칸 공통 스타일.
 *
 * `tabular-nums` 와 고정폭 글꼴(`--font-numeric`, Geist Mono)을 쓰는 이유는
 * 자릿수를 세로로 맞추기 위해서다. 비례폭 숫자로 찍으면 `0.3961` 과 `0.1297` 의
 * 소수점이 어긋나 세로로 훑을 수가 없다. `whitespace-nowrap` 은 390px 화면에서
 * `1,234명` 이 중간에 끊기는 것을 막는다.
 */
const NUMERIC_CELL =
  'whitespace-nowrap px-[var(--spacing-4)] py-[var(--spacing-3)] text-right font-[family-name:var(--font-numeric)] tabular-nums'

/**
 * 비교군 대학 비교표.
 *
 * 정렬하지 않는다. 서버가 1인당논문수 내림차순으로 주는 순서를 그대로 그린다.
 *
 * 표는 프레임 안에 있다 — 흰 면 + 1px `--border-strong` + 소프트 그림자(DESIGN.md §5).
 * 3단계는 이 표를 맨몸으로 두므로 틀은 표가 스스로 가진다. 대상 대학 행은
 * `--accent-soft` 바탕에 왼쪽 3px 주홍 — 이 화면에서 주홍이 가리키는 두 곳 중 하나다.
 */
export function CompareTable({
  rows,
  caption,
  highlightName,
  loading = false,
}: CompareTableProps) {
  // 가로 스크롤 영역의 이름을 caption 에서 가져온다. aria-label 로 같은
  // 문자열을 한 번 더 쓰면 스크린리더가 표 이름을 두 번 읽는다.
  const captionId = useId()

  if (loading) {
    return (
      // 스켈레톤은 sunken 면의 직각 블록 하나다. 틀을 두르지 않는다 — 레이아웃과 같은 크기면 된다.
      <div
        data-testid="compare-skeleton"
        aria-hidden="true"
        className="h-[16rem] w-full animate-pulse bg-[var(--surface-sunken)]"
      />
    )
  }

  if (rows.length === 0) {
    return (
      <div
        className="
          flex w-full items-center justify-center
          border border-dashed border-[var(--border-subtle)]
          bg-[var(--surface-raised)] p-[var(--spacing-6)]
          text-body text-[var(--text-muted)]
        "
      >
        표시할 데이터가 없습니다.
      </div>
    )
  }

  return (
    // 표를 줄여서 우겨넣지 않고 스크롤시킨다. 열을 좁히면 숫자가 줄바꿈되면서
    // 오히려 못 읽는다. tabIndex 를 주는 이유: 스크롤 영역에 포커스가 가지
    // 않으면 키보드만 쓰는 사람은 오른쪽 열들을 볼 방법이 없다.
    <div
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
      className="
        w-full overflow-x-auto
        border border-[var(--border-strong)] bg-[var(--surface-raised)]
        shadow-[var(--shadow-soft)]
      "
    >
      <table className="w-full min-w-[42rem] border-collapse text-body">
        {/* 표의 이름은 프레임의 머리글 — 아이브로. 아래 헤어라인으로 머리글 행과 나눈다. */}
        <caption
          id={captionId}
          className="
            eyebrow caption-top border-b border-[var(--border-subtle)]
            px-[var(--spacing-4)] py-[var(--spacing-4)]
            text-left text-[var(--text-secondary)]
          "
        >
          {caption}
        </caption>

        <thead>
          <tr className="border-b border-[var(--border-strong)]">
            <th scope="col" className={cn(HEADER_CELL, 'text-left')}>
              학교명
            </th>
            {NUMERIC_COLUMNS.map((column) => (
              <th key={column} scope="col" className={cn(HEADER_CELL, 'text-right')}>
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            // 완전 일치만 강조한다. 부분 일치를 허용하면 "호서" 가
            // "호서대학교" 를 물고, 캠퍼스 분교까지 함께 강조된다.
            const highlighted =
              highlightName !== undefined && row.name === highlightName

            return (
              <tr
                // 학교명은 유일하지 않을 수 있다(같은 이름이 두 번 오면 한
                // 행이 사라진다). 순번을 섞어 키 충돌을 막는다.
                key={`${row.name}::${index}`}
                data-highlight={highlighted ? 'true' : undefined}
                aria-current={highlighted ? 'true' : undefined}
                className={cn(
                  'border-b border-[var(--border-subtle)] last:border-b-0',
                  highlighted ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-sunken)]',
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    'break-keep px-[var(--spacing-4)] py-[var(--spacing-3)] text-left',
                    highlighted
                      ? // 강조를 색에만 맡기지 않는다. 굵기와 왼쪽 막대가 색을 못 보는
                        // 사람에게도 남는 단서다. 막대는 셀에 긋는다 — border-collapse
                        // 에서 tr 의 좌우 선은 브라우저가 그리지 않는다.
                        'border-l-[3px] border-l-[var(--accent)] font-semibold text-[var(--text-primary)]'
                      : 'font-normal text-[var(--text-secondary)]',
                  )}
                >
                  <span>{row.name}</span>
                  {/* 굵기·색·막대는 화면용이다. 스크린리더에는 말로 알린다. */}
                  {highlighted && <span className="sr-only">분석 대상</span>}
                </th>

                <td className={NUMERIC_CELL}>{formatFaculty(row.faculty)}</td>
                <td className={NUMERIC_CELL}>{formatPapers(row.papers)}</td>
                <td className={NUMERIC_CELL}>
                  {formatPerCapita(row.perCapita)}
                </td>
                <td className={NUMERIC_CELL}>
                  {formatRank(row.nationalRank)}
                </td>
                <td className={NUMERIC_CELL}>
                  {formatRank(row.regionalRank)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
