import { useEffect, useId, useRef, useState } from 'react'

import { cn } from '../../lib/cn'
import { filterOptions } from './filter'

export interface ComboboxProps {
  readonly label: string
  readonly options: readonly string[]
  /** 확정된 값. `null` 이면 아직 고르지 않았다. */
  readonly value: string | null
  /** 목록에 있는 값이 확정됐을 때만 불린다. */
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly hint?: string
  readonly disabled?: boolean
  readonly className?: string
  readonly 'data-testid'?: string
}

/**
 * 목록에서 고르는 검색 입력(WAI-ARIA combobox + listbox).
 *
 * **계약은 "목록에 없는 값이 확정되지 않는다" 다.**
 *
 * 원본 Streamlit 판은 `selectbox` 로 134개교를 가나다순 목록에서 고르게 했고
 * 타이핑 검색도 됐다. 없는 이름을 넣는 것이 구조적으로 불가능했다. 이관에서
 * 자유 텍스트 `<input>` 이 되는 바람에 오타 한 번이면 404 였다 — 사용자가
 * "기능이 사라졌다" 고 한 대표 사례다.
 *
 * `<select>` 로 되돌리지 않은 이유: 134개를 스크롤로만 찾게 하면 그것대로
 * 못 쓴다. 타이핑으로 좁히되 확정은 목록에서만 되게 한다.
 */
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  hint,
  disabled,
  className,
  'data-testid': testId,
}: ComboboxProps) {
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const statusId = `${baseId}-status`
  const hintId = hint ? `${baseId}-hint` : undefined

  const [open, setOpen] = useState(false)
  /** 입력창에 보이는 글자. 확정값과 다를 수 있다(타이핑 중). */
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // 확정값이 밖에서 바뀌면 입력창도 따라간다(리셋 등).
  useEffect(() => {
    setQuery(value ?? '')
  }, [value])

  const matches = open ? filterOptions(options, query) : []
  const empty = options.length === 0

  function close(revert: boolean) {
    setOpen(false)
    setActiveIndex(-1)
    // 확정하지 않고 닫으면 원래 값으로 되돌린다. 반쯤 친 글자가 남으면
    // 사용자는 그게 선택된 줄 안다.
    if (revert) setQuery(value ?? '')
  }

  function commit(name: string) {
    onChange(name)
    setQuery(name)
    setOpen(false)
    setActiveIndex(-1)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
        setActiveIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (matches.length ? (i + 1) % matches.length : -1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) =>
          matches.length ? (i <= 0 ? matches.length - 1 : i - 1) : -1,
        )
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(matches.length ? 0 : -1)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(matches.length - 1)
        break
      case 'Enter': {
        e.preventDefault()
        // 활성 항목이 없으면 정확히 일치하는 것만 확정한다. 첫 항목을
        // 자동으로 잡으면 "호서" 만 치고 Enter 한 사용자가 엉뚱한 대학을
        // 고르게 된다.
        const picked =
          activeIndex >= 0
            ? matches[activeIndex]
            : matches.find((o) => o.toLowerCase() === query.trim().toLowerCase())
        if (picked) commit(picked)
        break
      }
      case 'Tab':
        // Tab 은 막지 않는다 — 이동은 사용자의 것이다. 다만 확정은 안 한다.
        close(true)
        break
      default:
        break
    }
  }

  // 활성 항목을 보이는 범위로 끌어온다. 134개 중 40번째로 내려가면
  // 스크롤이 따라오지 않아 아무것도 선택되지 않은 것처럼 보인다.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    const item = listRef.current?.children[activeIndex]
    // scrollIntoView 는 어디에나 있지 않다(jsdom 에는 없다). 스크롤 위치는
    // 편의일 뿐이라, 없다고 선택 자체를 터뜨리면 안 된다.
    if (item instanceof HTMLElement && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [open, activeIndex])

  // 닫혀 있을 때는 `matches` 가 빈 배열이다. 그걸 그대로 읽으면 **아무것도
  // 치기 전에** "일치하는 대학이 없다" 가 뜬다 — 목록이 비어 있다는 뜻으로
  // 읽혀서, 쓸 수 있는 화면을 못 쓰는 화면처럼 보이게 만든다.
  const statusText = empty
    ? '고를 수 있는 대학이 없다'
    : !open
      ? `${options.length}개교에서 고른다`
      : matches.length === 0
        ? '일치하는 대학이 없다. 철자를 확인할 것'
        : `${options.length}개 중 ${matches.length}개`

  return (
    <div
      ref={rootRef}
      className={cn('relative flex flex-col gap-[var(--spacing-2)]', className)}
      onBlur={(e) => {
        // 콤보박스 안에서 옮겨 다니는 것은 이탈이 아니다(옵션 클릭 포함).
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) close(true)
      }}
    >
      <label htmlFor={baseId} className="text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </label>

      <input
        ref={inputRef}
        id={baseId}
        data-testid={testId}
        role="combobox"
        type="text"
        autoComplete="off"
        // 브라우저 자동완성이 목록 위에 겹쳐 뜨면 우리 목록을 가린다
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined
        }
        aria-describedby={[statusId, hintId].filter(Boolean).join(' ')}
        disabled={disabled || empty}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => !empty && setOpen(true)}
        onKeyDown={onKeyDown}
        className="
          w-full rounded-[var(--radius-md)] border border-[var(--border-strong)]
          bg-[var(--surface-raised)] px-[var(--spacing-3)] py-[var(--spacing-2)]
          text-sm text-[var(--text-primary)]
          transition-colors duration-[var(--duration-fast)]
          hover:enabled:border-[var(--accent)]
          disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:opacity-60
        "
      />

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="
            absolute top-full z-20 mt-[var(--spacing-1)] max-h-[16rem] w-full
            list-none overflow-y-auto overscroll-contain
            rounded-[var(--radius-md)] border border-[var(--border-strong)]
            bg-[var(--surface-raised)] p-[var(--spacing-1)]
            shadow-[var(--shadow-lg)]
          "
        >
          {matches.map((name, i) => (
            <li
              key={name}
              id={`${baseId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown 에서 처리한다. click 까지 기다리면 그 전에 blur 가
              // 먼저 나서 목록이 닫히고 클릭이 허공을 친다.
              onMouseDown={(e) => {
                e.preventDefault()
                commit(name)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                `cursor-pointer rounded-[var(--radius-sm)]
                 px-[var(--spacing-3)] py-[var(--spacing-2)] text-sm`,
                i === activeIndex
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-primary)]',
                name === value && 'font-semibold',
              )}
            >
              {name}
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-sm text-[var(--text-muted)]">
              일치하는 대학이 없다
            </li>
          )}
        </ul>
      )}

      {/* 몇 개 중 몇 개가 보이는지 알려준다. 134개 목록에서 이 숫자가 없으면
          더 칠지 스크롤할지 판단할 수 없다. */}
      <p id={statusId} role="status" className="m-0 text-xs text-[var(--text-muted)]">
        {statusText}
      </p>
      {hint && (
        <p id={hintId} className="m-0 text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
    </div>
  )
}
