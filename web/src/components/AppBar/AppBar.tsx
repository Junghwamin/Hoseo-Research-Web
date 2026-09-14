import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import type { ThemeChoice } from '../../theme/useTheme'

export interface AppBarProps {
  readonly productName: string
  /** 제품명 옆 짧은 설명. 좁은 화면에서는 숨긴다. */
  readonly tagline?: string
  readonly theme: ThemeChoice
  readonly onThemeChange: (next: ThemeChoice) => void
  /** 오른쪽 끝에 붙는 것들(설정 버튼 등). */
  readonly actions?: ReactNode
}

const THEME_LABELS: Record<ThemeChoice, string> = {
  light: '라이트',
  dark: '다크',
  system: '시스템',
}

/**
 * 상단 고정 바.
 *
 * 스크롤해도 따라온다 — 5단계를 오가는 화면이라 "어디에 있는지" 를 잡아 주는
 * 고정 지점이 필요하다. 높이를 낮게 유지하고 경계선 하나로만 지면과 나눈다.
 */
export function AppBar({
  productName,
  tagline,
  theme,
  onThemeChange,
  actions,
}: AppBarProps) {
  return (
    <header
      className="
        sticky top-0 z-10 border-b border-[var(--border-subtle)]
        bg-[var(--surface-overlay)] backdrop-blur
      "
    >
      <div
        className="
          mx-auto flex max-w-[var(--container-content)] flex-wrap items-center
          justify-between gap-[var(--spacing-4)]
          px-[var(--spacing-5)] py-[var(--spacing-3)]
        "
      >
        <div className="flex items-center gap-[var(--spacing-3)]">
          {/* 로고 자리. 이미지 파일을 쓰지 않는 이유는 오프라인 설치본에서
              경로 하나가 어긋나면 깨진 아이콘이 남기 때문이다. */}
          <span
            aria-hidden="true"
            className="
              inline-flex h-[1.75rem] w-[1.75rem] items-center justify-center
              rounded-[var(--radius-sm)] bg-[var(--action-bg)]
              text-xs font-bold text-[var(--text-on-action)]
            "
          >
            R
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {productName}
          </span>
          {tagline && (
            <span className="hidden text-xs text-[var(--text-muted)] sm:inline">
              {tagline}
            </span>
          )}
        </div>

        <div className="flex items-center gap-[var(--spacing-3)]">
          {/* 세그먼트 컨트롤. 버튼 셋을 한 틀에 넣으면 "셋 중 하나" 라는
              관계가 눈에 보인다 — 따로 떨어져 있으면 토글 셋으로 읽힌다. */}
          <div
            role="group"
            aria-label="테마 선택"
            className="
              flex gap-[var(--spacing-1)] rounded-[var(--radius-md)]
              bg-[var(--surface-sunken)] p-[var(--spacing-1)]
            "
          >
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onThemeChange(t)}
                aria-pressed={theme === t}
                className={cn(
                  `rounded-[var(--radius-sm)] px-[var(--spacing-3)] py-[var(--spacing-1)]
                   text-xs transition-colors duration-[var(--duration-fast)]`,
                  theme === t
                    ? 'bg-[var(--surface-raised)] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
          {actions}
        </div>
      </div>
    </header>
  )
}
