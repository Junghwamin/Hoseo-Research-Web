import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export interface CardProps {
  /** 제목 위의 작은 라벨. 없으면 그리지 않는다. */
  readonly eyebrow?: string
  readonly title?: string
  /** 제목 아래 한 줄 설명. */
  readonly description?: ReactNode
  /** 제목 줄 오른쪽(필터·버튼 등). */
  readonly actions?: ReactNode
  readonly className?: string
  readonly bodyClassName?: string
  /** 접근성 이름. 제목이 없거나 제목과 다르게 불러야 할 때 쓴다. */
  readonly ariaLabel?: string
  readonly children: ReactNode
}

/**
 * 구획 카드.
 *
 * 흰 지면 위에 **얇은 선**으로만 구획한다. 그림자로 띄우지 않는 이유는
 * 이 화면이 대부분 숫자와 표라서다 — 떠 있는 카드가 여럿이면 어느 것이
 * 위인지 읽느라 정작 숫자를 못 본다.
 */
export function Card({
  eyebrow,
  title,
  description,
  actions,
  className,
  bodyClassName,
  ariaLabel,
  children,
}: CardProps) {
  const hasHeader = Boolean(eyebrow || title || description || actions)

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        `rounded-[var(--radius-lg)] border border-[var(--border-subtle)]
         bg-[var(--surface-raised)]`,
        className,
      )}
    >
      {hasHeader && (
        <header
          className="
            flex flex-wrap items-start justify-between gap-[var(--spacing-4)]
            border-b border-[var(--border-subtle)]
            px-[var(--spacing-5)] py-[var(--spacing-4)]
          "
        >
          <div className="flex flex-col gap-[var(--spacing-1)]">
            {eyebrow && (
              <span className="text-eyebrow font-semibold uppercase text-[var(--accent)]">
                {eyebrow}
              </span>
            )}
            {title && (
              <h3 className="m-0 text-heading font-semibold text-[var(--text-primary)]">
                {title}
              </h3>
            )}
            {description && (
              <p className="m-0 text-sm text-[var(--text-secondary)]">{description}</p>
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
