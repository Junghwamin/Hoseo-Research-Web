import { useMemo, useState } from 'react'

import type { UniversityRow } from '../../api/client'
import { cn } from '../../lib/cn'
import { Button } from '../../design/ui'

export interface CompareGroupPickerProps {
  /** 권역 안의 대학 전체. 여기 없는 이름은 고를 수 없다. */
  readonly rows: readonly UniversityRow[]
  /** 분석 대상. 자기 자신은 비교군에 넣지 않는다. */
  readonly target: string | null
  /** 확정된 선택. `null` 이면 서버 기본 비교군에 맡긴다. */
  readonly value: readonly string[] | null
  readonly onChange: (next: readonly string[] | null) => void
  readonly loading?: boolean
  readonly error?: string | null
  readonly regionName?: string | null
}

/** 한 화면에 이 이상 체크박스를 늘어놓으면 고르는 게 아니라 훑게 된다. */
const VISIBLE_WITHOUT_SEARCH = 12

/**
 * 비교군 선택.
 *
 * 원본 Streamlit 판은 `multiselect` 로 권역 안의 대학을 직접 고르게 했다.
 * 이관 후에는 서버 기본값(권역 상위 N개)만 쓰였고, 사용자가 비교 대상을
 * 정할 방법이 없었다 — 보고서의 "비교군 비교" 절 전체가 고정된 셈이다.
 *
 * `null`(서버에 맡김)과 빈 배열(아무도 안 고름)을 구분한다. 서버는 빈
 * 배열을 받으면 기본값으로 되돌리므로, 화면에서 그 상태를 만들지 않는다.
 */
export function CompareGroupPicker({
  rows,
  target,
  value,
  onChange,
  loading,
  error,
  regionName,
}: CompareGroupPickerProps) {
  const [query, setQuery] = useState('')

  // 자기 자신은 후보에서 뺀다. 자기와 비교하는 막대는 의미가 없다.
  const candidates = useMemo(
    () => rows.filter((r) => r.name !== target),
    [rows, target],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((r) => r.name.toLowerCase().includes(q))
  }, [candidates, query])

  const usingDefault = value === null
  const selected = useMemo(() => new Set(value ?? []), [value])

  function toggle(name: string) {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    // 전부 해제하면 서버 기본값으로 되돌린다 — 빈 비교군은 차트가
    // 그려지지 않고, 사용자가 원한 것도 대개 "그냥 기본값" 이다.
    onChange(next.size === 0 ? null : [...next])
  }

  if (error) {
    return (
      <p role="alert" className="m-0 text-sm text-[var(--color-down)]">
        비교군 후보를 불러오지 못했다: {error}
      </p>
    )
  }

  if (loading) {
    return (
      <p className="m-0 text-sm text-[var(--text-muted)]">비교군 후보를 불러오는 중…</p>
    )
  }

  if (candidates.length === 0) {
    return (
      <p className="m-0 text-sm text-[var(--text-muted)]">
        {regionName ? `${regionName} 에 ` : ''}비교할 다른 대학이 없다.
      </p>
    )
  }

  const showSearch = candidates.length > VISIBLE_WITHOUT_SEARCH

  return (
    <div className="flex flex-col gap-[var(--spacing-3)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--spacing-3)]">
        <p className="m-0 text-sm text-[var(--text-secondary)]" data-testid="compare-picker-summary">
          {usingDefault
            ? `서버 기본 비교군을 쓴다 (${regionName ?? '권역'} 상위권)`
            : `${selected.size}개교 선택`}
        </p>
        {!usingDefault && (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            기본 비교군으로
          </Button>
        )}
      </div>

      {showSearch && (
        <input
          type="search"
          aria-label="비교군 후보 검색"
          placeholder={`${candidates.length}개교에서 찾기`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="
            w-full rounded-[var(--radius-md)] border border-[var(--border-strong)]
            bg-[var(--surface-raised)] px-[var(--spacing-3)] py-[var(--spacing-2)]
            text-sm text-[var(--text-primary)]
            hover:border-[var(--accent)]
          "
        />
      )}

      <ul
        data-testid="compare-candidates"
        // 목록이 길어도 화면을 밀어내지 않게 한다. 1단계에서 아래 버튼이
        // 화면 밖으로 밀리면 "다음" 을 못 찾는다.
        className="
          m-0 max-h-[18rem] list-none overflow-y-auto overscroll-contain
          rounded-[var(--radius-md)] border border-[var(--border-subtle)]
          p-[var(--spacing-1)]
        "
      >
        {filtered.map((row) => {
          const checked = selected.has(row.name)
          return (
            <li key={row.name}>
              <label
                className={cn(
                  `flex cursor-pointer items-center justify-between gap-[var(--spacing-3)]
                   rounded-[var(--radius-sm)] px-[var(--spacing-3)] py-[var(--spacing-2)]
                   text-sm hover:bg-[var(--surface-sunken)]`,
                  checked && 'bg-[var(--accent-soft)]',
                )}
              >
                <span className="flex items-center gap-[var(--spacing-3)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(row.name)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-[var(--text-primary)]">{row.name}</span>
                </span>
                {/* 숫자를 함께 보여준다. 이름만 보고 비교군을 고르라는 것은
                    무엇을 고르는지 모르고 고르라는 말이다. */}
                <span className="tabular shrink-0 text-xs text-[var(--text-muted)]">
                  {row.regionalRank != null && `권역 ${row.regionalRank}위 · `}
                  {row.perCapita.toFixed(4)}편
                </span>
              </label>
            </li>
          )
        })}
        {filtered.length === 0 && (
          <li className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-sm text-[var(--text-muted)]">
            일치하는 대학이 없다
          </li>
        )}
      </ul>
    </div>
  )
}
