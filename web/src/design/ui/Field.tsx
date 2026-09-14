import { useId, type ReactNode } from 'react'

import { cn } from '../../lib/cn'

export interface FieldControlProps {
  readonly id: string
  readonly 'aria-describedby': string | undefined
  readonly 'aria-invalid': true | undefined
}

export interface FieldProps {
  readonly label: string
  /** 라벨 아래 보조 설명. 오류가 아니라 사용법을 적는다. */
  readonly hint?: ReactNode
  readonly error?: string | null
  readonly className?: string
  /** 컨트롤을 그리는 함수. 연결에 필요한 id·aria 속성을 받는다. */
  readonly children: (props: FieldControlProps) => ReactNode
}

/**
 * 라벨 + 컨트롤 + 설명/오류 묶음.
 *
 * `aria-describedby` 연결을 손으로 하면 빠뜨린다 — 그리고 빠뜨려도 화면은
 * 멀쩡해 보인다. 여기서 한 번만 맞춰 둔다.
 */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  // 오류를 먼저 읽힌다. 설명보다 급한 정보다.
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-[var(--spacing-2)]', className)}>
      <label htmlFor={id} className="text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {error && (
        <p id={errorId} role="alert" className="m-0 text-xs text-[var(--color-down)]">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="m-0 text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
    </div>
  )
}

/** 입력·선택 공통 외형. 컨트롤마다 복사하면 하나만 어긋난다. */
export const CONTROL_CLASS = `
  w-full rounded-[var(--radius-md)] border border-[var(--border-strong)]
  bg-[var(--surface-raised)] px-[var(--spacing-3)] py-[var(--spacing-2)]
  text-sm text-[var(--text-primary)]
  transition-colors duration-[var(--duration-fast)]
  hover:enabled:border-[var(--accent)]
  disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:opacity-60
`
