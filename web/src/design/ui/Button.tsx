import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  /** 진행 중 표시. 누를 수 없게 하고 라벨을 대체한다. */
  readonly busy?: boolean
  readonly busyLabel?: string
  readonly children: ReactNode
}

/**
 * 버튼 한 곳.
 *
 * 이 파일이 있는 이유: Wizard 한 화면에 같은 스타일 문자열이 여섯 번
 * 복사돼 있었다. 복사본이 생기는 순간 하나만 고치는 사고가 나고, 그게
 * Streamlit 판 `styles.py` 가 829줄까지 자란 경로다.
 *
 * 색·간격은 전부 토큰이다(§12-1). 여기에 hex 가 들어오면 `tokens.test.ts`
 * 가 잡는다.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  // 주 행동. 한 화면에 하나다 — 검은 알약이 둘이면 어느 쪽이 다음인지 모른다.
  primary: `
    border-[var(--action-bg)] bg-[var(--action-bg)] text-[var(--text-on-action)]
    hover:enabled:border-[var(--action-bg-hover)] hover:enabled:bg-[var(--action-bg-hover)]
  `,
  secondary: `
    border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-primary)]
    hover:enabled:border-[var(--accent)] hover:enabled:text-[var(--accent)]
  `,
  ghost: `
    border-transparent bg-transparent text-[var(--text-secondary)]
    hover:enabled:bg-[var(--surface-sunken)] hover:enabled:text-[var(--text-primary)]
  `,
  danger: `
    border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]
    hover:enabled:border-[var(--color-down)] hover:enabled:text-[var(--color-down)]
  `,
}

// 알약이라 좌우 여백이 위아래보다 넉넉해야 글자가 갇히지 않는다.
const SIZES: Record<ButtonSize, string> = {
  sm: 'px-[var(--spacing-4)] py-[var(--spacing-1)] text-xs',
  md: 'px-[var(--spacing-5)] py-[var(--spacing-2)] text-sm',
  lg: 'px-[var(--spacing-6)] py-[var(--spacing-3)] text-sm',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  busyLabel,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      // 진행 중인 작업을 두 번 누르면 요청이 겹친다. disabled 와 별개로
      // aria-busy 를 주어 스크린리더에도 알린다.
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={cn(
        `inline-flex items-center justify-center gap-[var(--spacing-2)]
         rounded-[var(--radius-full)] border font-medium
         transition-colors duration-[var(--duration-fast)]
         disabled:cursor-not-allowed disabled:opacity-45`,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  )
}
