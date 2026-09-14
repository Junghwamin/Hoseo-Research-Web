import { MetricCard } from './components/MetricCard/MetricCard'
import { FEATURES } from './features'
import { useTheme } from './theme/useTheme'

/**
 * Phase 1 확인용 셸.
 *
 * 이 화면의 목적은 "검증 루프가 실제로 도는가" 뿐이다. 실제 5단계 화면은
 * Phase 5 에서 붙인다. 다만 **꺼진 기능은 렌더 트리에 올리지 않는다**는
 * 규칙(§12-4)은 여기서부터 지킨다.
 */
const MODULES = [
  { key: 'research', label: '연구실적', icon: '📊' },
  { key: 'educationCost', label: '교육비환원율', icon: '📈' },
  { key: 'employment', label: '취업률', icon: '💼' },
] as const

export default function App() {
  const { choice, resolved, setTheme } = useTheme()

  const visible = MODULES.filter((m) => FEATURES[m.key])

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-[var(--spacing-6)] p-[var(--spacing-6)]">
      <header className="flex items-center justify-between gap-[var(--spacing-4)]">
        <div>
          <h1 className="m-0 text-2xl font-bold text-[var(--text-primary)]">
            연구실적 분석 포털
          </h1>
          <p className="mt-[var(--spacing-1)] text-sm text-[var(--text-secondary)]">
            현재 테마: {resolved} ({choice})
          </p>
        </div>

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
        <ul className="flex list-none gap-[var(--spacing-3)] p-0">
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

      <section
        aria-label="지표 미리보기"
        className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-[var(--spacing-4)]"
      >
        <MetricCard
          label="전국순위"
          value="71위"
          caption="2026년 기준 · 등재 사립 133개교"
          delta={{ label: '+6계단', direction: 'up', srLabel: '전국순위 6계단 상승' }}
        />
        <MetricCard
          label="1인당논문수"
          value="0.1297편"
          caption="2026년 기준"
          delta={{ label: '+0.0115편', direction: 'up', srLabel: '1인당논문수 0.0115편 증가' }}
        />
        <MetricCard label="전임교원수" value="406명" caption="2026년 기준" />
        <MetricCard label="권역순위" value={null} caption="데이터 없음" />
      </section>
    </main>
  )
}
