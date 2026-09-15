import { byYear } from '../../../api/client'
import { ChartGallery } from '../../../components/ChartGallery'
import { CompareTable } from '../../../components/CompareTable'
import { TrendChart } from '../../../components/TrendChart'
import { YoYPanel } from '../../../components/YoYPanel'
import { Card } from '../../../design/ui'
import type { StepProps } from './types'

/**
 * 3단계: 그래프 검토.
 *
 * **여기 보이는 그림이 그대로 Word 에 들어간다.** 원본 Streamlit 판은 5종을
 * 보여주며 "보고서에 그대로 삽입됩니다" 라고 안내했고, 실제로 같은 PNG 를
 * 썼다. 이관 후에는 추이 하나만 화면에 남아서, 나머지 4종은 **문서를 열기
 * 전에는 볼 수 없었다** — 확인 단계의 의미가 없어진 셈이다.
 *
 * 추이만 인터랙티브(recharts)로 한 번 더 그린다. 값을 짚어 읽는 용도라
 * 목적이 다르다. 나머지 4종은 서버 PNG 가 유일한 표현이다.
 */
export function Step3Charts({ state }: StepProps) {
  const { stats } = state
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
    <div className="flex flex-col gap-[var(--spacing-6)]">
      <Card
        eyebrow="인터랙티브"
        title="1인당 논문 수 추이"
        description="값을 짚어 읽는 용도다. 문서에는 아래의 서버 차트가 실린다."
      >
        <TrendChart
          series={trendSeries}
          valueLabel="1인당 논문 수(편)"
          description={`${stats.university}, ${stats.regionName} 평균, 전국 평균, 비교군 평균의 1인당 논문 수 추이`}
          precision={4}
        />
      </Card>

      <Card
        eyebrow="보고서 수록"
        title="Word 에 들어가는 차트"
        description="아래 그림이 그대로 문서에 삽입된다. 여기서 확인한 것과 문서가 다르지 않다."
        bodyClassName="p-[var(--spacing-4)]"
      >
        <ChartGallery
          university={stats.university}
          year={stats.year}
          regionName={stats.regionName}
          compareGroup={stats.compareGroup}
          years={stats.years}
          dataVersion={stats.dataVersion}
          // 추이는 위에서 인터랙티브로 봤다. 같은 그림을 두 번 그리면
          // 화면만 길어진다.
          kinds={['bar', 'avg', 'rank', 'compare']}
        />
      </Card>

      <Card
        eyebrow="비교군"
        title={`${stats.year}년 ${stats.regionName} 비교군 ${stats.compare.length}개교`}
        bodyClassName="p-0"
      >
        <CompareTable
          rows={stats.compare}
          caption={`${stats.year}년 ${stats.regionName} 비교군 ${stats.compare.length}개교 연구실적`}
          highlightName={stats.university}
        />
      </Card>

      <Card eyebrow="전년 대비" title="증감 상·하위">
        {/* baseYear 가 현재, compareYear 가 이전이다. 뒤집으면 화면에
            "2026 → 2025" 가 남는다(R-RS-03). */}
        <YoYPanel
          changes={stats.yoy}
          baseYear={stats.year}
          compareYear={stats.year - 1}
        />
      </Card>
    </div>
  )
}
