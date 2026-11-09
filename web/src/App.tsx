import { Suspense, lazy, useState } from 'react'

import { AppBar } from './components/AppBar'
import { HomeHero } from './components/HomeHero'
import { Button, Icon, Modal, Pending } from './design/ui'
import { FEATURES } from './features'
import { useDataset, useSettings } from './features/wizard/hooks'
import { WizardShell } from './features/wizard/WizardShell'
import { WizardProvider } from './store/WizardProvider'
import { useTheme } from './theme/useTheme'

// 두 패널은 열 때만 필요하다. 첫 화면 번들에 넣지 않는다 — 배럴을 거쳐 지연 로드.
const DataUpdatePanel = lazy(() =>
  import('./components/DataUpdatePanel').then((m) => ({ default: m.DataUpdatePanel })),
)
const SettingsPanel = lazy(() =>
  import('./components/SettingsPanel').then((m) => ({ default: m.SettingsPanel })),
)

/**
 * 앱 셸.
 *
 * 꺼진 기능은 렌더 트리에 올리지 않는다(§6·§12-4). Streamlit 판에서는 홈 카드
 * 2/3 과 사이드바 모듈 절반이 "Coming Soon" 장식이었고, 그게 사용자가
 * "불편하다" 고 한 실체다.
 *
 * 한 페이지다 — 상단바, 히어로(표제 + 자료 현황 패널), 모듈 줄, 마법사, 쓰임
 * 띠, 푸터. 본문 폭을 72rem 으로 묶는 이유는 표의 한 줄이 길어지면 눈이 행을
 * 놓치기 때문이다.
 *
 * 설정·데이터 패널의 **동작 모드**는 서버의 `canPersist` 가 정한다 — 서버 디스크에
 * 쓸 수 있으면(설치본·로컬) 서버에 저장하고, 없으면(공개 사이트) 브라우저에만 둔다.
 */
const MODULES = [
  { key: 'research', label: '연구실적', hint: '전임교원 SCI급·SCOPUS 논문' },
  { key: 'educationCost', label: '교육비환원율', hint: '' },
  { key: 'employment', label: '취업률', hint: '' },
] as const

/** 「어디에 쓰는가」. 수치는 쓰지 않는다 — 숫자는 서버에서만 온다. */
const USES = [
  {
    title: '자체평가 보고서',
    body: '연구실적 절의 표 3개·차트 5장·서술 4절을 한 번에 만들어 그대로 붙입니다.',
  },
  {
    title: '기획처·총장 보고',
    body: '전국·권역·비교군 평균 사이에서 우리 대학의 자리를 숫자로 보입니다.',
  },
  {
    title: '연도별 추이',
    body: '공시된 모든 해의 1인당 논문 수와 순위 변화를 표와 그래프로 봅니다.',
  },
  {
    title: 'Word 보고서',
    body: '화면에서 확인한 차트·표·서술이 그대로 문서가 됩니다.',
  },
] as const

/** 「분석 시작」 — 1단계 입력으로 내려가 포커스를 준다. 휴대폰 첫 화면용. */
function startAnalysis() {
  document.getElementById('wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  document
    .querySelector<HTMLElement>('[data-testid="university-input"]')
    ?.focus({ preventScroll: true })
}

export default function App() {
  const { choice, setTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  /**
   * 데이터를 다시 만들거나 브라우저에 더할 때마다 오른다. `WizardProvider` 의 `key` 라서,
   * 올라가면 마법사가 통째로 새로 마운트된다.
   *
   * 데이터 변경은 대학·연도·순위를 전부 바꿀 수 있다. 화면에 남아 있던 분석
   * 결과는 **더는 존재하지 않는 데이터를 가리킨다** — 리셋이 아니라 잔재다.
   * 어떤 키를 지울지 고르는 대신 트리를 새로 만든다(V17 과 같은 판단).
   */
  const [dataVersion, setDataVersion] = useState(0)
  // 히어로의 자료 현황과 마법사가 같은 응답을 본다. 한 번만 받는다.
  const dataset = useDataset(dataVersion)
  // 패널의 모드(서버 저장 / 브라우저 저장). 열 때 결정돼 있어야 하므로 미리 묻는다.
  const settings = useSettings()
  const dataMode = settings.data ? (settings.data.canPersist ? 'persist' : 'browser') : null
  // 버튼과 모달 제목은 같은 말을 쓴다. 공개 사이트는 서버 데이터를 갱신하지 않고 브라우저에 더한다.
  const dataLabel = dataMode === 'browser' ? '데이터 추가' : '데이터 갱신'
  const visible = MODULES.filter((m) => FEATURES[m.key])

  return (
    // data-app-root: 모달이 열리면 이 안이 inert 가 된다(design/ui/Modal).
    <div data-app-root className="flex min-h-screen flex-col bg-[var(--surface-base)]">
      <AppBar
        productName="연구실적 분석 포털"
        tagline="대학알리미 공시자료"
        theme={choice}
        onThemeChange={setTheme}
        actions={
          // 좁은 화면에서는 아이콘만 남긴다. 접근성 이름은 sr-only 글자가 그대로 준다.
          <>
            {FEATURES.dataUpdate && (
              <Button
                size="sm"
                variant="ghost"
                data-testid="data-update-toggle"
                aria-expanded={dataOpen}
                aria-controls="data-update-panel"
                onClick={() => setDataOpen(true)}
              >
                <Icon name="upload" className="sm:hidden" />
                <span className="sr-only sm:not-sr-only">{dataLabel}</span>
              </Button>
            )}
            {FEATURES.settings && (
              <Button
                size="sm"
                data-testid="settings-toggle"
                aria-expanded={settingsOpen}
                aria-controls="settings-panel"
                onClick={() => setSettingsOpen(true)}
              >
                <Icon name="settings" className="sm:hidden" />
                <span className="sr-only sm:not-sr-only">설정</span>
              </Button>
            )}
          </>
        }
      />

      {/* 패널은 모달이다. 본문 위에 카드로 끼우면 마법사가 아래로 밀리고,
          닫는 길이 멀다. 열린 동안 뒤 화면은 inert(design/ui/Modal). */}
      {FEATURES.dataUpdate && (
        <Modal
          id="data-update-panel"
          title={dataLabel}
          open={dataOpen}
          onClose={() => setDataOpen(false)}
        >
          {dataMode ? (
            <Suspense fallback={<Pending label="패널을 불러오는 중" />}>
              <DataUpdatePanel
                mode={dataMode}
                onUpdated={() => setDataVersion((v) => v + 1)}
                onClose={() => setDataOpen(false)}
              />
            </Suspense>
          ) : settings.error ? (
            <div className="flex flex-wrap items-center justify-between gap-[var(--spacing-3)]">
              <p role="alert" className="m-0 text-body text-[var(--color-down)]">
                서버 설정을 불러오지 못했습니다. {settings.error}
              </p>
              <Button size="sm" onClick={settings.reload}>
                다시 시도
              </Button>
            </div>
          ) : (
            <Pending label="서버 설정을 확인하는 중" />
          )}
        </Modal>
      )}
      {FEATURES.settings && (
        <Modal
          id="settings-panel"
          title="설정"
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        >
          <Suspense fallback={<Pending label="패널을 불러오는 중" />}>
            <SettingsPanel onClose={() => setSettingsOpen(false)} onSaved={settings.reload} />
          </Suspense>
        </Modal>
      )}

      <HomeHero
        dataset={dataset.data}
        datasetError={dataset.error}
        onRetry={dataset.reload}
        onStart={startAnalysis}
      />

      <main
        id="wizard"
        className="
          mx-auto flex w-full max-w-[var(--container-content)] flex-col
          gap-[var(--spacing-7)]
          px-[var(--spacing-5)] py-[var(--spacing-7)]
        "
      >
        <nav aria-label="분석 모듈" className="border-b border-[var(--border-subtle)]">
          <ul className="m-0 flex list-none flex-wrap gap-[var(--spacing-5)] p-0">
            {visible.map((m) => (
              <li key={m.key} className="-mb-px">
                {/* 모듈 밑줄은 잉크다 — 주홍은 현재 단계와 기준 연도의 몫이다. */}
                <span
                  data-testid={`module-${m.key}`}
                  aria-current="true"
                  className="
                    inline-flex items-baseline gap-[var(--spacing-2)]
                    border-b-2 border-[var(--text-primary)]
                    pb-[var(--spacing-3)]
                    text-body font-semibold text-[var(--text-primary)]
                  "
                >
                  {m.label}
                  {m.hint && (
                    <span className="text-meta font-normal text-[var(--text-muted)]">
                      {m.hint}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <WizardProvider key={dataVersion}>
          <WizardShell dataset={dataset} />
        </WizardProvider>
      </main>

      <section
        aria-label="어디에 쓰는가"
        className="border-y border-[var(--border-subtle)] bg-[var(--surface-alt)]"
      >
        <div
          className="
            mx-auto grid max-w-[var(--container-content)] gap-[var(--spacing-6)]
            px-[var(--spacing-5)] py-[var(--spacing-8)] md:grid-cols-[1fr_2fr]
          "
        >
          <h2 className="m-0 text-heading font-semibold text-[var(--text-primary)]">
            어디에 쓰는가
          </h2>
          <ol className="m-0 grid list-none gap-[var(--spacing-5)] p-0 sm:grid-cols-2">
            {USES.map((u, i) => (
              <li key={u.title} className="flex gap-[var(--spacing-3)]">
                <span className="eyebrow-mono pt-[var(--spacing-1)] text-[var(--text-muted)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex flex-col gap-[var(--spacing-1)]">
                  <h3 className="m-0 text-body font-semibold text-[var(--text-primary)]">{u.title}</h3>
                  <p className="m-0 text-body text-[var(--text-secondary)]">{u.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="mt-auto">
        <div
          className="
            mx-auto flex max-w-[var(--container-content)] flex-wrap
            justify-between gap-[var(--spacing-4)]
            px-[var(--spacing-5)] py-[var(--spacing-6)]
            text-meta text-[var(--text-muted)]
          "
        >
          <span>출처 대학알리미 전임교원 연구실적 공시자료</span>
          <span>글꼴 Pretendard · Geist Mono (SIL OFL)</span>
        </div>
      </footer>
    </div>
  )
}
