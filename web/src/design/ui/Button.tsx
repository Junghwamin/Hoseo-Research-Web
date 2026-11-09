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
 * 모양은 DESIGN.md §6 이다 — 직각, 호버에 하드 오프셋 그림자가 뜨며 1px
 * 떠오르고, 누르면 그림자가 사라지며 1px 내려앉는다. 비활성은 투명도가
 * 아니라 sunken 채움 + muted 글자다: 흐려진 버튼은 "죽은 버튼" 으로 읽혔다.
 * 색·간격은 전부 토큰이다. 여기에 hex 가 들어오면 `tokens.test.ts` 가 잡는다.
 */

// 선이 있는 변형만 떠오른다. ghost 는 선이 없어서 그림자가 뜨면 빈 사각형이 떠다닌다.
const LIFT = `
  hover:enabled:shadow-[var(--shadow-hard)]
  hover:enabled:-translate-x-px hover:enabled:-translate-y-px
`

const VARIANTS: Record<ButtonVariant, string> = {
  // 누르는 것. 한 화면에 하나다 — 잉크 사각이 둘이면 어느 쪽이 다음인지 모른다.
  primary: `
    border-[var(--action-bg)] bg-[var(--action-bg)] text-[var(--text-on-action)]
    hover:enabled:border-[var(--action-bg-hover)] hover:enabled:bg-[var(--action-bg-hover)]
    ${LIFT}
  `,
  // 투명 + 1px 선, 호버에 흰 채움. 주홍은 가리키는 데 쓰지 호버에 쓰지 않는다.
  secondary: `
    border-[var(--border-strong)] bg-transparent text-[var(--text-primary)]
    hover:enabled:bg-[var(--surface-raised)]
    ${LIFT}
  `,
  ghost: `
    border-transparent bg-transparent text-[var(--text-secondary)]
    hover:enabled:bg-[var(--surface-sunken)] hover:enabled:text-[var(--text-primary)]
  `,
  // secondary 에 악화 색의 글자·선. 「처음부터 다시」처럼 되돌릴 수 없는 행동에 쓴다.
  danger: `
    border-[var(--color-down)] bg-transparent text-[var(--color-down)]
    hover:enabled:bg-[var(--surface-raised)]
    ${LIFT}
  `,
}

// 높이 32 / 36 / 44px. 같은 줄의 입력(44px)·칩과 가운데가 맞아야 한다.
// 라벨 크기는 높이와 무관하게 본문 하나다 — 큰 버튼이 큰 글자는 아니다.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-[2rem] px-[var(--spacing-3)]',
  md: 'h-[2.25rem] px-[var(--spacing-4)]',
  lg: 'h-[2.75rem] px-[var(--spacing-6)]',
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
         whitespace-nowrap rounded-none border
         text-body font-semibold tracking-[0.02em]
         transition duration-[var(--duration-fast)]
         active:enabled:translate-x-px active:enabled:translate-y-px active:enabled:shadow-none
         disabled:cursor-not-allowed disabled:border-[var(--border-subtle)]
         disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-muted)]`,
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
