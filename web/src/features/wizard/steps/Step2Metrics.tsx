import { MetricCard, type DeltaDirection } from '../../../components/MetricCard'
import { YearTable } from '../../../components/YearTable'
import { Card } from '../../../design/ui'
import type { StepProps } from './types'

/** 순위 변화는 API 가 이미 "양수 = 개선" 으로 계산해 온다. 다시 뒤집지 않는다(V09). */
function rankDirection(delta: number | null | undefined): DeltaDirection {
  if (delta === null || delta === undefined || delta === 0) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

function rankLabel(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '비교 없음'
  if (delta === 0) return '변동 없음'
  return `${delta > 0 ? '+' : ''}${delta}계단`
}

/** 증감률은 "개선/악화" 로 읽는다. 1인당논문수는 늘면 개선이다. */
function rateDirection(rate: number | null | undefined): DeltaDirection {
  if (rate === null || rate === undefined || rate === 0) return 'flat'
  return rate > 0 ? 'up' : 'down'
}

function rateLabel(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '비교 없음'
  return `${rate > 0 ? '+' : ''}${(rate * 100).toFixed(1)}%`
}

/**
 * 2단계: 주요 지표와 연도별 상세.
 *
 * 표가 다시 생긴 자리다. 원본은 `dataframe` 으로 연도별 수치를 보여줬는데
 * 이관 후에는 차트의 `sr-only` 표만 남아, **눈으로 보는 사용자는 값을 짚어
 * 읽을 방법이 없었다.** 보고서에 실릴 숫자를 확인하는 단계이므로 표가
 * 카드보다 중요하다.
 */
export function Step2Metrics({ state }: StepProps) {
  const { stats } = state
  if (!stats) return null

  const year = stats.year
  const point = stats.trend[String(year)]
  const rank = stats.rankChanges[String(year)]
  const yoy = stats.yoy.target

  return (
    <div className="flex flex-col gap-[var(--spacing-6)]">
      <section
        aria-label="주요 지표"
        className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-[var(--spacing-4)]"
      >
        <MetricCard
          label="전국순위"
          value={point?.nationalRank != null ? `${point.nationalRank}위` : null}
          caption={`${year}년 기준`}
          delta={
            rank
              ? {
                  label: rankLabel(rank.nationalRankDelta),
                  direction: rankDirection(rank.nationalRankDelta),
                  srLabel: `전국순위 ${rankLabel(rank.nationalRankDelta)}`,
                }
              : undefined
          }
        />
        <MetricCard
          label="권역순위"
          value={point?.regionalRank != null ? `${point.regionalRank}위` : null}
          caption={stats.regionName}
          delta={
            rank
              ? {
                  label: rankLabel(rank.regionalRankDelta),
                  direction: rankDirection(rank.regionalRankDelta),
                  srLabel: `권역순위 ${rankLabel(rank.regionalRankDelta)}`,
                }
              : undefined
          }
        />
        <MetricCard
          label="1인당논문수"
          value={point ? `${point.perCapita.toFixed(4)}편` : null}
          caption={`${year}년 기준`}
          // 전년 대비 증감률. 이 카드만 증감이 없어서, 늘었는지 줄었는지
          // 알려면 표까지 내려가야 했다.
          delta={
            yoy
              ? {
                  label: rateLabel(yoy.changeRate),
                  direction: rateDirection(yoy.changeRate),
                  srLabel: `전년 대비 ${rateLabel(yoy.changeRate)}`,
                }
              : undefined
          }
        />
        <MetricCard
          label="전임교원수"
          value={point ? `${point.faculty.toLocaleString('ko-KR')}명` : null}
          caption={`${year}년 기준`}
        />
      </section>

      <Card
        eyebrow="연도별 상세"
        // 개수를 박아 두면 연도를 고른 순간 제목이 거짓이 된다. 새 연도가
        // 들어와도 마찬가지다 — 데이터가 자라는 것은 정상 운영이다.
        title={`${stats.years.length}개년 수치`}
        description="보고서에 실리는 숫자다. 차트로는 소수 넷째 자리를 구분할 수 없다."
        bodyClassName="p-0"
      >
        <YearTable
          trend={stats.trend}
          averages={stats.averages}
          rankChanges={stats.rankChanges}
          university={stats.university}
          regionName={stats.regionName}
          baseYear={year}
        />
      </Card>
    </div>
  )
}
