import { useId } from 'react'

import { byYear } from '../../../api/client'
import { overlayKey } from '../../../api/overlay'
import { ChartGallery } from '../../../components/ChartGallery'
import { CompareTable } from '../../../components/CompareTable'
import { TrendChart } from '../../../components/TrendChart'
import { YoYPanel } from '../../../components/YoYPanel'
import { Icon } from '../../../design/ui'
import type { StepProps } from './types'

/** Word 보고서에 실리는 순서. 문서와 같은 순서로 검토한다. */
const WORD_ORDER = ['trend', 'avg', 'bar', 'rank', 'compare'] as const

/**
 * 3단계: 그래프 검토.
 *
 * **여기 보이는 그림이 그대로 Word 에 들어간다.** 원본 Streamlit 판은 5종을
 * 보여주며 "보고서에 그대로 삽입됩니다" 라고 안내했고, 실제로 같은 PNG 를
 * 썼다. 이관 후에는 추이 하나만 화면에 남아서, 나머지 4종은 **문서를 열기
 * 전에는 볼 수 없었다** — 확인 단계의 의미가 없어진 셈이다.
 *
 * 다섯 장을 문서 순서대로 전부 보인다. 추이의 인터랙티브 판(recharts)은
 * 값을 짚어 읽는 보조 도구라 접어 둔다 — 같은 그림이 둘 보이면 어느 쪽이
 * 문서에 실리는지 헷갈린다.
 *
 * 브라우저에 더한 데이터가 있으면 차트는 POST 로 받는다(`overlayKey`) — 주소에
 * 실을 수 없는 추가 데이터가 본문으로 가야 그림이 Word 와 같아진다.
 *
 * 구획은 카드가 아니라 헤어라인이다. 카드 안에 카드가 들어가면 테두리만 세 겹이다.
 */
export function Step3Charts({ state }: StepProps) {
  const { stats } = state
  const ids = { charts: useId(), compare: useId(), yoy: useId() }
  if (!stats) return null

  const trendSeries = [
    {
      name: stats.university,
      emphasis: true,
      points: byYear(stats.trend).map((r) => ({ year: r.year, value: r.perCapita })),
    },
    {
      name: `${stats.regionName} 평균`,
      points: byYear(stats.averages).map((r) => ({ year: r.year, value: r.regional ?? null })),
    },
    {
      name: '전국 평균',
      points: byYear(stats.averages).map((r) => ({ year: r.year, value: r.national ?? null })),
    },
    // 비교군 평균. 서버가 늘 계산해 보내는데 화면 어디에서도 쓰지 않았다 —
    // 비교군을 직접 고르게 하면서 이 선이 없으면 고른 보람이 없다.
    {
      name: '비교군 평균',
      points: byYear(stats.averages).map((r) => ({
        year: r.year,
        value: r.compareGroup ?? null,
      })),
    },
  ]

  return (
    <div className="flex flex-col gap-[var(--spacing-7)]">
      <section aria-labelledby={ids.charts} className="flex flex-col gap-[var(--spacing-4)]">
        <h3 id={ids.charts} className="m-0 text-heading font-semibold text-[var(--text-primary)]">
          Word 에 실리는 차트 5장
        </h3>
        <ChartGallery
          university={stats.university}
          year={stats.year}
          regionName={stats.regionName}
          compareGroup={stats.compareGroup}
          years={stats.years}
          dataVersion={stats.dataVersion}
          kinds={WORD_ORDER}
          featured="trend"
          overlayKey={overlayKey()}
        />

        <details className="group border border-[var(--border-subtle)]">
          <summary
            className="
              flex cursor-pointer list-none items-center justify-between gap-[var(--spacing-3)]
              px-[var(--spacing-4)] py-[var(--spacing-3)] text-body font-medium
              text-[var(--text-primary)]
            "
          >
            값 짚어 보기 · 인터랙티브 추이
            <Icon
              name="chevron-down"
              className="transition-transform duration-[var(--duration-fast)] group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-[var(--border-subtle)] p-[var(--spacing-4)]">
            <p className="m-0 mb-[var(--spacing-3)] text-body text-[var(--text-secondary)]">
              문서에는 위 차트가 실립니다. 이 그래프는 점을 가리켜 값을 읽을 때 씁니다.
            </p>
            <TrendChart
              series={trendSeries}
              valueLabel="1인당 논문 수(편)"
              description={`${stats.university}, ${stats.regionName} 평균, 전국 평균, 비교군 평균의 1인당 논문 수 추이`}
              precision={4}
            />
          </div>
        </details>
      </section>

      <section
        aria-labelledby={ids.compare}
        className="flex flex-col gap-[var(--spacing-4)] border-t border-[var(--border-subtle)] pt-[var(--spacing-6)]"
      >
        <h3 id={ids.compare} className="m-0 text-heading font-semibold text-[var(--text-primary)]">
          {`${stats.year}년 ${stats.regionName} 비교군 ${stats.compare.length}개교`}
        </h3>
        <CompareTable
          rows={stats.compare}
          caption={`${stats.year}년 ${stats.regionName} 비교군 ${stats.compare.length}개교 연구실적`}
          highlightName={stats.university}
        />
      </section>

      <section
        aria-labelledby={ids.yoy}
        className="flex flex-col gap-[var(--spacing-4)] border-t border-[var(--border-subtle)] pt-[var(--spacing-6)]"
      >
        <h3 id={ids.yoy} className="m-0 text-heading font-semibold text-[var(--text-primary)]">
          전년 대비 증감 상·하위
        </h3>
        {/* baseYear 가 현재, compareYear 가 이전이다. 뒤집으면 화면에
            "2026 → 2025" 가 남는다(R-RS-03). */}
        <YoYPanel changes={stats.yoy} baseYear={stats.year} compareYear={stats.year - 1} />
      </section>
    </div>
  )
}
