import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type CardVariant = 'frame' | 'panel' | 'plain'

export interface CardProps {
  readonly title?: string
  /** 제목 아래 한 줄 설명. */
  readonly description?: ReactNode
  /** 제목 줄 오른쪽(필터·버튼 등). */
  readonly actions?: ReactNode
  /**
   * frame(기본) — 흰 면 + 1px 선 + 소프트 그림자.
   * panel — frame 위에 4px 주홍 띠. 페이지에서 가장 중요한 숫자 묶음 하나에만 쓴다.
   * plain — 선·그림자 없이 머리글 구조만 빌린다.
   */
  readonly variant?: CardVariant
  readonly className?: string
  readonly bodyClassName?: string
  /** 접근성 이름. 제목이 없거나 제목과 다르게 불러야 할 때 쓴다. */
  readonly ariaLabel?: string
  readonly children: ReactNode
}

/**
 * 프레임.
 *
 * 격자가 깔린 지면 위의 흰 면 하나. 깊이는 1px 선과 하드 오프셋 그림자가
 * 만들고, 블러는 없다(DESIGN.md §5). 머리글 제목은 아이브로 — 작고 자간이
 * 넓은 라벨이라 본문의 숫자·표와 경쟁하지 않는다. `panel` 의 주홍 띠는
 * 「여기가 가장 중요한 숫자」라는 표시이므로 한 화면에 하나다.
 */
const VARIANTS: Record<CardVariant, string> = {
  frame: `
    border border-[var(--border-strong)] bg-[var(--surface-raised)]
    shadow-[var(--shadow-soft)]
  `,
  panel: `
    border border-[var(--border-strong)] border-t-4 border-t-[var(--accent)]
    bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]
  `,
  plain: 'bg-transparent',
}

export function Card({
  title,
  description,
  actions,
  variant = 'frame',
  className,
  bodyClassName,
  ariaLabel,
  children,
}: CardProps) {
  const hasHeader = Boolean(title || description || actions)

  return (
    <section
      aria-label={ariaLabel}
      data-variant={variant}
      className={cn('rounded-none', VARIANTS[variant], className)}
    >
      {hasHeader && (
        <header
          className={cn(
            `flex flex-wrap items-start justify-between gap-[var(--spacing-4)]
             px-[var(--spacing-5)] py-[var(--spacing-4)]`,
            variant !== 'plain' && 'border-b border-[var(--border-subtle)]',
          )}
        >
          <div className="flex flex-col gap-[var(--spacing-2)]">
            {title && <h3 className="eyebrow m-0 text-[var(--text-secondary)]">{title}</h3>}
            {description && (
              <p className="m-0 text-body text-[var(--text-secondary)]">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-[var(--spacing-2)]">
              {actions}
            </div>
          )}
        </header>
      )}
      <div className={cn('p-[var(--spacing-5)]', bodyClassName)}>{children}</div>
    </section>
  )
}
