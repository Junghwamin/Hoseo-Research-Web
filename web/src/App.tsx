import { useState } from 'react'

import { AppBar } from './components/AppBar'
import { DataUpdatePanel } from './components/DataUpdatePanel'
import { HomeHero } from './components/HomeHero'
import { MediaBand } from './components/MediaBand'
import { SettingsPanel } from './components/SettingsPanel'
import { Button, Card } from './design/ui'
import { FEATURES } from './features'
import { WizardShell } from './features/wizard/WizardShell'
import { WizardProvider } from './store/WizardProvider'
import { useTheme } from './theme/useTheme'

/**
 * 앱 셸.
 *
 * 꺼진 기능은 렌더 트리에 올리지 않는다(§6·§12-4). Streamlit 판에서는 홈 카드
 * 2/3 과 사이드바 모듈 절반이 "Coming Soon" 장식이었고, 그게 사용자가
 * "불편하다" 고 한 실체다.
 *
 * 레이아웃은 세 층이다 — 고정 상단바, 전체 폭 히어로, 가운데 정렬 본문.
 * 히어로만 전체 폭인 이유는 그것이 사진 구간이라서다. 본문까지 넓히면
 * 표의 한 줄이 너무 길어져 눈이 행을 놓친다.
 */
const MODULES = [
  { key: 'research', label: '연구실적', hint: '전임교원 SCI/SCOPUS 논문' },
  { key: 'educationCost', label: '교육비환원율', hint: '' },
  { key: 'employment', label: '취업률', hint: '' },
] as const

/** 번들된 배경 사진. CDN 을 쓰면 오프라인 설치본에서 통째로 빈다. */
const HERO_IMAGE = '/media/hero-reading-room.webp'
const BAND_IMAGE = '/media/band-library.webp'

export default function App() {
  const { choice, setTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  /**
   * 데이터를 다시 만들 때마다 오른다. `WizardProvider` 의 `key` 라서,
   * 올라가면 마법사가 통째로 새로 마운트된다.
   *
   * 전처리는 대학·연도·순위를 전부 바꿀 수 있다. 화면에 남아 있던 분석
   * 결과는 **더는 존재하지 않는 데이터를 가리킨다** — 리셋이 아니라 잔재다.
   * 어떤 키를 지울지 고르는 대신 트리를 새로 만든다(V17 과 같은 판단).
   */
  const [dataVersion, setDataVersion] = useState(0)
  const visible = MODULES.filter((m) => FEATURES[m.key])

  return (
    <div className="min-h-screen bg-[var(--surface-base)]">
      <AppBar
        productName="연구실적 분석 포털"
        tagline="대학알리미 공시자료"
        theme={choice}
        onThemeChange={setTheme}
        actions={
          <>
            {FEATURES.dataUpdate && (
              <Button
                size="sm"
                variant="ghost"
                data-testid="data-update-toggle"
                aria-expanded={dataOpen}
                aria-controls="data-update-panel"
                onClick={() => setDataOpen((v) => !v)}
              >
                데이터 갱신
              </Button>
            )}
            {FEATURES.settings && (
              <Button
                size="sm"
                data-testid="settings-toggle"
                aria-expanded={settingsOpen}
                aria-controls="settings-panel"
                onClick={() => setSettingsOpen((v) => !v)}
              >
                설정
              </Button>
            )}
          </>
        }
      />

      <HomeHero
        eyebrow="대학알리미 공시자료 분석"
        title="연구실적을 권역 기준으로 읽는다"
        subtitle="전임교원 SCI/SCOPUS 논문 실적을 권역·비교군과 나란히 놓고, 확인한 그대로 Word 보고서로 만든다."
        imageSrc={HERO_IMAGE}
      />

      <main
        className="
          mx-auto flex max-w-[var(--container-content)] flex-col
          gap-[var(--spacing-7)]
          px-[var(--spacing-5)] py-[var(--spacing-7)]
        "
      >
        {dataOpen && FEATURES.dataUpdate && (
          <section id="data-update-panel" aria-label="데이터 갱신">
            <Card eyebrow="데이터 갱신" title="Raw Excel 업로드">
              <DataUpdatePanel
                onUpdated={() => setDataVersion((v) => v + 1)}
                onClose={() => setDataOpen(false)}
              />
            </Card>
          </section>
        )}

        {settingsOpen && FEATURES.settings && (
          <section id="settings-panel" aria-label="설정">
            <Card eyebrow="설정" title="OpenAI API 키">
              <SettingsPanel onClose={() => setSettingsOpen(false)} />
            </Card>
          </section>
        )}

        <nav aria-label="분석 모듈">
          <ul className="m-0 flex list-none flex-wrap gap-[var(--spacing-3)] p-0">
            {visible.map((m) => (
              <li key={m.key}>
                <span
                  data-testid={`module-${m.key}`}
                  aria-current="true"
                  className="
                    inline-flex items-baseline gap-[var(--spacing-2)]
                    border-b-2 border-[var(--accent)]
                    pb-[var(--spacing-2)]
                    text-sm font-semibold text-[var(--text-primary)]
                  "
                >
                  {m.label}
                  {m.hint && (
                    <span className="text-xs font-normal text-[var(--text-muted)]">
                      {m.hint}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <WizardProvider key={dataVersion}>
          <WizardShell />
        </WizardProvider>
      </main>

      <MediaBand
        eyebrow="결과물"
        title="확인한 그대로 문서가 된다"
        imageSrc={BAND_IMAGE}
      >
        <p className="m-0 text-lead">
          3단계에서 본 차트 5장이 그대로 Word 에 들어간다. 표 3개와 GPT 서술
          4개가 함께 실리고, 서술은 문서를 만들기 전에 직접 고칠 수 있다.
        </p>
      </MediaBand>

      <footer
        className="
          mt-[var(--spacing-8)] border-t border-[var(--border-subtle)]
          bg-[var(--surface-sunken)]
        "
      >
        <div
          className="
            mx-auto flex max-w-[var(--container-content)] flex-wrap
            justify-between gap-[var(--spacing-4)]
            px-[var(--spacing-5)] py-[var(--spacing-6)]
            text-xs text-[var(--text-muted)]
          "
        >
          <span>출처: 대학알리미 전임교원 연구실적 공시자료</span>
          {/* 사진 출처. CC0 라 표시 의무는 없지만, 어디서 왔는지 모르는
              파일이 번들에 들어 있는 상태를 만들지 않는다. */}
          <span>배경 사진 CC0 · 자세한 출처는 media/CREDITS.md</span>
        </div>
      </footer>
    </div>
  )
}
