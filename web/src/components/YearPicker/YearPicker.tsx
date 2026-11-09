import { useMemo } from 'react'

import { cn } from '../../lib/cn'
import { Button } from '../../design/ui'
import { YEAR_PRESETS, matchingPreset } from './presets'

export interface YearPickerProps {
  /** 데이터에 있는 연도 전부. 여기 없는 해는 고를 수 없다. */
  readonly available: readonly number[]
  /** 고른 해. 오름차순으로 들어온다. */
  readonly value: readonly number[]
  readonly onChange: (next: readonly number[]) => void
  /**
   * 기준 연도. 지운다고 막지는 않되 **표시로 구분한다.**
   *
   * 비교표·전년대비·막대차트가 이 한 해를 본다. 어느 것이 그 해인지 보이지
   * 않으면, 체크를 풀었을 때 기준 연도가 조용히 옮겨간 것처럼 느껴진다.
   */
  readonly baseYear: number | null
}

/**
 * 분석 연도 선택 — 직각 칩, 모노 숫자.
 *
 * 원본 Streamlit 판의 `st.multiselect("분석 연도 선택", ...)`(`research.py:614`)
 * 이 하던 일이다. 이관에서 빠지면서 추이·평균·순위가 **언제나 전 연도**로
 * 그려졌다 — 최근 3년만 보고 싶어도 방법이 없었다.
 *
 * 체크박스 대신 토글 칩을 쓴다. 연도는 값이 짧고 개수가 고정이라 한 줄에
 * 늘어놓을 수 있고, 그러면 "무엇이 빠졌는지" 를 훑어서 알 수 있다. 세로로
 * 쌓인 체크박스 목록에서는 그게 안 보인다.
 *
 * 선택된 칩은 **잉크 채움**이지 주홍이 아니다(DESIGN.md §2). 주홍은 기준 연도를
 * 가리키는 작은 사각 하나뿐이다 — 글리프(■)가 아니라 CSS 로 그린다. 모노 글꼴
 * 서브셋에 그 글자가 없어 폴백 글꼴의 다른 모양이 섞여 나온다.
 */
export function YearPicker({ available, value, onChange, baseYear }: YearPickerProps) {
  const sorted = useMemo(() => [...available].sort((a, b) => a - b), [available])
  const selected = useMemo(() => new Set(value), [value])
  const activePreset = matchingPreset(sorted, value)

  function toggle(year: number) {
    const next = new Set(selected)
    if (next.has(year)) next.delete(year)
    else next.add(year)
    onChange([...next].sort((a, b) => a - b))
  }

  if (sorted.length === 0) {
    return (
      <p className="m-0 text-body text-[var(--text-muted)]">연도를 불러오는 중…</p>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-3)]">
      <div
        role="group"
        aria-label="분석 연도"
        data-testid="year-picker"
        className="flex flex-wrap gap-[var(--spacing-2)]"
      >
        {sorted.map((year) => {
          const checked = selected.has(year)
          const isBase = year === baseYear
          return (
            <button
              key={year}
              type="button"
              role="checkbox"
              aria-checked={checked}
              // 기준 연도라는 사실은 시각 표시로만 두면 화면 낭독기가 놓친다.
              aria-label={isBase ? `${year}년 (기준 연도)` : `${year}년`}
              onClick={() => toggle(year)}
              className={cn(
                `tabular inline-flex h-[2.25rem] items-center rounded-none border
                 px-[var(--spacing-3)] font-[family-name:var(--font-numeric)]
                 text-body font-medium transition-colors duration-[var(--duration-fast)]`,
                checked
                  ? 'border-[var(--action-bg)] bg-[var(--action-bg)] text-[var(--text-on-action)]'
                  : `border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)]
                     hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]`,
              )}
            >
              {year}
              {isBase && (
                <span
                  aria-hidden="true"
                  className="ml-[var(--spacing-1)] inline-block h-[0.375rem] w-[0.375rem] bg-[var(--accent)]"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-[var(--spacing-3)]">
        {YEAR_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            size="sm"
            variant={activePreset === preset.label ? 'secondary' : 'ghost'}
            onClick={() => onChange(preset.pick(sorted))}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
