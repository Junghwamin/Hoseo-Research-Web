import type { ReactNode } from 'react'

import { Icon, type IconName } from '../../design/ui'
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

const THEME_ICONS: Record<ThemeChoice, IconName> = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor',
}

/**
 * 상단 고정 바.
 *
 * 스크롤해도 따라온다 — 5단계를 오가는 화면이라 "어디에 있는지" 를 잡아 주는
 * 고정 지점이 필요하다. 지면색 92% 에 blur 8px — 격자가 깔린 지면 위를 지나는
 * 동안 뒤가 살짝 비친다(tom-modern 헤더). 블러가 허용되는 유일한 자리다
 * (DESIGN.md §5); 그 밖의 깊이는 전부 선과 하드 오프셋 그림자다.
 *
 * 높이는 토큰(--appbar-h, 56px)이고 **아래 1px 선을 포함한 값**이다 — 컨텍스트
 * 바의 sticky 오프셋과 html 의 스크롤 패딩이 같은 값을 본다. 한 줄 고정 — 좁아도
 * 줄을 바꾸지 않는다(390px 에서 글자가 한 자씩 쪼개지며 두 줄이 된 적이 있다).
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
        sticky top-0 z-20 h-[var(--appbar-h)] border-b border-[var(--border-subtle)]
        bg-[color-mix(in_srgb,var(--surface-base)_92%,transparent)] backdrop-blur-[8px]
      "
    >
      <div
        className="
          mx-auto flex h-full max-w-[var(--container-content)] flex-nowrap
          items-center justify-between gap-[var(--spacing-4)] px-[var(--spacing-5)]
        "
      >
        {/* 워드마크는 글자다. 이미지 로고를 쓰지 않는 이유는 오프라인 설치본에서
            경로 하나가 어긋나면 깨진 아이콘이 남기 때문이고, 사각형 이니셜은
            아무것도 말하지 않기 때문이다. */}
        <div className="flex min-w-0 items-baseline gap-[var(--spacing-3)]">
          <span className="whitespace-nowrap text-body font-semibold text-[var(--text-primary)]">
            {productName}
          </span>
          {tagline && (
            <span className="hidden whitespace-nowrap text-meta text-[var(--text-muted)] sm:inline">
              {tagline}
            </span>
          )}
        </div>

        <div className="flex items-center gap-[var(--spacing-3)]">
          {/* 세그먼트 컨트롤 — 직각 틀 하나에 셋. 버튼 셋을 한 틀에 넣으면 "셋 중
              하나" 라는 관계가 눈에 보인다. 선택된 것은 sunken 면 + 600 이지 잉크
              채움이 아니다(잉크 사각은 주 행동 하나뿐). 좁은 화면에서는 아이콘만
              남기되 접근성 이름은 같다 — e2e 와 보조 기술이 '다크'·'시스템' 으로 찾는다. */}
          <div
            role="group"
            aria-label="테마 선택"
            className="flex rounded-none border border-[var(--border-strong)]"
          >
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onThemeChange(t)}
                aria-pressed={theme === t}
                aria-label={THEME_LABELS[t]}
                className={cn(
                  `flex h-[1.75rem] min-w-[1.75rem] items-center justify-center
                   whitespace-nowrap rounded-none border-l border-[var(--border-subtle)]
                   px-[var(--spacing-2)] text-meta
                   transition-colors duration-[var(--duration-fast)] first:border-l-0`,
                  theme === t
                    ? 'bg-[var(--surface-sunken)] font-semibold text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
              >
                <Icon name={THEME_ICONS[t]} className="sm:hidden" />
                <span className="hidden sm:inline">{THEME_LABELS[t]}</span>
              </button>
            ))}
          </div>
          {actions}
        </div>
      </div>
    </header>
  )
}
