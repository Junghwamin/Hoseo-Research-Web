import { FEATURES } from './features'
import { Wizard } from './routes/Wizard'
import { WizardProvider } from './store/WizardProvider'
import { useTheme } from './theme/useTheme'

/**
 * 앱 셸.
 *
 * 꺼진 기능은 렌더 트리에 올리지 않는다(§6·§12-4). Streamlit 판에서는 홈 카드
 * 2/3 과 사이드바 모듈 절반이 "Coming Soon" 장식이었고, 그게 사용자가
 * "불편하다" 고 한 실체다.
 */
const MODULES = [
  { key: 'research', label: '연구실적', icon: '📊' },
  { key: 'educationCost', label: '교육비환원율', icon: '📈' },
  { key: 'employment', label: '취업률', icon: '💼' },
] as const

export default function App() {
  const { choice, setTheme } = useTheme()
  const visible = MODULES.filter((m) => FEATURES[m.key])

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-[var(--spacing-6)] p-[var(--spacing-6)]">
      <header className="flex flex-wrap items-center justify-between gap-[var(--spacing-4)]">
        <h1 className="m-0 text-2xl font-bold text-[var(--text-primary)]">
          연구실적 분석 포털
        </h1>

        <div className="flex gap-[var(--spacing-2)]" role="group" aria-label="테마 선택">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              aria-pressed={choice === t}
              className="
                rounded-[var(--radius-md)] border border-[var(--border-subtle)]
                bg-[var(--surface-raised)] px-[var(--spacing-3)] py-[var(--spacing-2)]
                text-sm text-[var(--text-secondary)]
                transition-colors duration-[var(--duration-fast)]
                hover:border-[var(--border-strong)]
                aria-pressed:border-[var(--accent)]
                aria-pressed:bg-[var(--accent-soft)]
                aria-pressed:text-[var(--accent)]
              "
            >
              {t === 'light' ? '라이트' : t === 'dark' ? '다크' : '시스템'}
            </button>
          ))}
        </div>
      </header>

      <nav aria-label="분석 모듈">
        <ul className="flex list-none flex-wrap gap-[var(--spacing-3)] p-0">
          {visible.map((m) => (
            <li key={m.key}>
              <span
                data-testid={`module-${m.key}`}
                className="
                  inline-flex items-center gap-[var(--spacing-2)]
                  rounded-[var(--radius-md)] border border-[var(--border-subtle)]
                  bg-[var(--surface-raised)] px-[var(--spacing-4)] py-[var(--spacing-2)]
                  text-sm font-medium text-[var(--text-primary)]
                "
              >
                <span aria-hidden="true">{m.icon}</span>
                {m.label}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      <WizardProvider>
        <Wizard />
      </WizardProvider>
    </main>
  )
}
