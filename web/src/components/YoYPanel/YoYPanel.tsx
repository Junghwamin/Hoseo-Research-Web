import { useId } from 'react'

import { describeChange, findDuplicateNames, formatYearRange } from './transform'
import type { YoYDirection, YoYEntry, YoYPanelProps } from './types'

/** 화살표는 장식이다 — 의미는 언제나 sr-only 라벨이 전달한다(§요구 4). */
const ARROW: Record<YoYDirection, string> = {
  up: '▲',
  down: '▼',
  flat: '',
  new: '',
}

/**
 * 증감 표기. 방향에 따라 글자색이 바뀌지만 **색은 보조 신호일 뿐이다.**
 * 화살표와 음성 라벨이 없으면 색맹 사용자에게 증가와 감소가 같아 보인다.
 * 알약 배경은 없다 — 색은 숫자에만 있다(설계 §3.3). "신규" 는 14px 글자라
 * 주홍 원색이 아니라 어둡게 깎은 `--accent-text` 다(작은 글자의 AA).
 */
function ChangeBadge({ rate }: { rate: number | null | undefined }) {
  const view = describeChange(rate)

  return (
    <span
      data-testid="yoy-change"
      data-direction={view.direction}
      className="
        inline-flex shrink-0 items-center gap-[var(--spacing-1)]
        font-[family-name:var(--font-numeric)] text-body font-medium tabular-nums
        data-[direction=up]:text-[var(--color-up)]
        data-[direction=down]:text-[var(--color-down)]
        data-[direction=flat]:text-[var(--color-neutral)]
        data-[direction=new]:text-[var(--accent-text)]
      "
    >
      {ARROW[view.direction] && (
        <span aria-hidden="true">{ARROW[view.direction]}</span>
      )}
      <span aria-hidden="true">{view.label}</span>
      <span className="sr-only">{view.srLabel}</span>
    </span>
  )
}

/** 한 대학의 한 줄. 이름·증감률·두 해의 값이 항상 같이 다닌다. */
function EntryRow({
  entry,
  baseYear,
  compareYear,
}: {
  entry: YoYEntry
  baseYear: number
  compareYear: number
}) {
  return (
    <li
      className="
        flex flex-col gap-[var(--spacing-1)]
        border-b border-[var(--border-subtle)] py-[var(--spacing-2)]
        last:border-b-0
      "
    >
      <div className="flex items-center justify-between gap-[var(--spacing-2)]">
        <span className="text-body font-medium text-[var(--text-primary)]">
          {entry.name}
        </span>
        <ChangeBadge rate={entry.changeRate} />
      </div>

      {/* 증감률만 보여주면 "몇에서 몇으로" 를 알 수 없다. 두 해의 실제 값을
          과거 → 현재 순서로 함께 둔다(R-RS-03). */}
      <span
        data-testid="yoy-range"
        className="
          font-[family-name:var(--font-numeric)] text-meta tabular-nums
          text-[var(--text-muted)]
        "
      >
        {formatYearRange(compareYear, entry.compareValue, baseYear, entry.baseValue)}
      </span>
    </li>
  )
}

/** 증가 상위 / 감소 하위 한 덩어리. */
function EntryList({
  title,
  entries,
  baseYear,
  compareYear,
}: {
  title: string
  entries: readonly YoYEntry[]
  baseYear: number
  compareYear: number
}) {
  // id 를 손으로 붙이면 패널이 한 화면에 둘 이상 올 때 중복 id 가 된다.
  const headingId = useId()

  return (
    // landmark(region)가 아니라 group 이다. section 으로 두면 패널이 한 화면에
    // 둘 이상 올 때 "증가 상위" 랜드마크가 여럿 생겨 스크린리더의 랜드마크
    // 목록에서 서로 구분되지 않는다(axe landmark-unique). 이 목록은 바깥
    // 섹션의 일부이지 독립된 탐색 지점이 아니다.
    <div role="group" aria-labelledby={headingId} className="min-w-0 flex-1">
      {/* 구획 라벨은 아이브로 — 짧은 한국어 명사. */}
      <h4
        id={headingId}
        className="eyebrow m-0 mb-[var(--spacing-3)] text-[var(--text-secondary)]"
      >
        {title}
      </h4>

      {entries.length === 0 ? (
        <p className="m-0 text-meta text-[var(--text-muted)]">해당 없음</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {entries.map((e) => (
            <EntryRow
              key={e.name}
              entry={e}
              baseYear={baseYear}
              compareYear={compareYear}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * 전년 대비 증감 상·하위 패널.
 *
 * 증감률을 여기서 다시 계산하지 않는다. 서버가 준 `changeRate` 를 그대로
 * 믿고 그리되, **`null` 만은 숫자로 접지 않는다**(V12). 연도 표기는 언제나
 * 비교연도 → 기준연도, 즉 과거에서 현재로 흐른다(R-RS-03).
 *
 * 카드 안의 카드가 아니다 — 두 목록은 세로 선 하나로 나눈다. 분석 대상은
 * 왼쪽 3px 주홍 막대 하나로 가리킨다(표의 대상 행과 같은 장치).
 */
export function YoYPanel({
  changes,
  baseYear,
  compareYear,
  loading = false,
}: YoYPanelProps) {
  // 없음을 빈 목록으로 읽는 자리는 여기 한 곳이다. 아래 코드는 배열이라고
  // 믿고 쓴다 — 방어를 흩뜨리면 한 군데는 반드시 빠진다.
  const top = changes.top ?? []
  const bottom = changes.bottom ?? []
  const target = changes.target ?? null

  if (loading) {
    return (
      <div
        data-testid="yoy-skeleton"
        aria-hidden="true"
        className="flex flex-col gap-[var(--spacing-3)]"
      >
        <div className="h-[3rem] animate-pulse bg-[var(--surface-sunken)]" />
        <div className="h-[8rem] animate-pulse bg-[var(--surface-sunken)]" />
      </div>
    )
  }

  const duplicates = findDuplicateNames(top, bottom)
  const noComparison = top.length === 0 && bottom.length === 0

  return (
    <div className="flex flex-col gap-[var(--spacing-5)]">
      {duplicates.length > 0 && (
        // 조용히 그리면 "증가 1위이자 감소 1위" 라는 표가 보고서에 그대로 실린다.
        <p
          role="alert"
          className="
            m-0 border border-[var(--color-down)] bg-[var(--color-down-soft)]
            p-[var(--spacing-3)] text-body text-[var(--color-down)]
          "
        >
          비교군이 작아 증가 상위와 감소 하위에 같은 대학이 함께 나옵니다:{' '}
          {duplicates.map((name, i) => (
            <span key={name} className="font-semibold">
              {i > 0 && ', '}
              <span>{name}</span>
            </span>
          ))}
        </p>
      )}

      {/* target 은 null 일 수 있다 — 비교군에 대상이 없으면 서버가 비워 보낸다.
          분석 대상은 주홍 세로 막대 하나로 표시한다. 상자가 아니다. */}
      {target && (
        <div
          data-testid="yoy-target"
          className="
            flex flex-col gap-[var(--spacing-2)]
            border-l-[3px] border-l-[var(--accent)] pl-[var(--spacing-4)]
          "
        >
          <span className="eyebrow text-[var(--text-secondary)]">분석 대상</span>
          <div className="flex items-center justify-between gap-[var(--spacing-2)]">
            <span className="text-heading font-semibold text-[var(--text-primary)]">
              {target.name}
            </span>
            <ChangeBadge rate={target.changeRate} />
          </div>
          <span
            data-testid="yoy-range"
            className="
              font-[family-name:var(--font-numeric)] text-meta tabular-nums
              text-[var(--text-secondary)]
            "
          >
            {formatYearRange(
              compareYear,
              target.compareValue,
              baseYear,
              target.baseValue,
            )}
          </span>
        </div>
      )}

      {noComparison ? (
        <p
          className="
            m-0 border border-dashed border-[var(--border-subtle)]
            p-[var(--spacing-5)] text-center text-body text-[var(--text-muted)]
          "
        >
          전년도 자료가 없습니다.
        </p>
      ) : (
        <div
          className="
            flex flex-col gap-[var(--spacing-5)]
            sm:flex-row sm:gap-0 sm:divide-x sm:divide-[var(--border-subtle)]
            sm:[&>*+*]:pl-[var(--spacing-5)] sm:[&>*]:pr-[var(--spacing-5)] sm:[&>:last-child]:pr-0
          "
        >
          <EntryList
            title="증가 상위"
            entries={top}
            baseYear={baseYear}
            compareYear={compareYear}
          />
          <EntryList
            title="감소 하위"
            entries={bottom}
            baseYear={baseYear}
            compareYear={compareYear}
          />
        </div>
      )}
    </div>
  )
}
