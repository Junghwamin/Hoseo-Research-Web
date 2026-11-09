import type { ComponentProps } from 'react'

import type { YoYEntry } from '../../../api/client'
import { MetricCard, type DeltaDirection } from '../../../components/MetricCard'
import { YearTable } from '../../../components/YearTable'
import { describeChange } from '../../../components/YoYPanel'
import { Card } from '../../../design/ui'
import type { StepProps } from './types'

type Delta = NonNullable<ComponentProps<typeof MetricCard>['delta']>

/** 순위 변화는 API 가 이미 "양수 = 개선" 으로 계산해 온다. 다시 뒤집지 않는다(V09). */
function rankDirection(delta: number | null | undefined): DeltaDirection {
  if (delta === null || delta === undefined || delta === 0) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

function rankLabel(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '전년 자료 없음'
  if (delta === 0) return '변동 없음'
  return `${delta > 0 ? '+' : ''}${delta}계단`
}

function rankDelta(scope: string, delta: number | null | undefined): Delta {
  return {
    label: rankLabel(delta),
    direction: rankDirection(delta),
    srLabel: `${scope} ${rankLabel(delta)}`,
  }
}

/**
 * 1인당논문수의 전년 대비 증감.
 *
 * YoYPanel 과 **같은 함수**(`describeChange`)로 읽는다. 서버의 `changeRate` 는
 * 이미 퍼센트(9.7)다 — 여기서 한 번 더 ×100 해서 `+970.0%` 가 찍힌 적이 있다.
 * 같은 숫자를 두 곳이 다르게 그리면 어느 쪽이 맞는지 화면에서 알 수 없다.
 */
function perCapitaDelta(yoy: YoYEntry | null | undefined): Delta {
  if (!yoy) {
    return { label: '전년 자료 없음', direction: 'flat', srLabel: '전년 대비 자료 없음' }
  }
  const view = describeChange(yoy.changeRate)
  return {
    label: view.label,
    // MetricCard 는 '신규' 를 따로 색칠하지 않는다 — 라벨이 이미 말한다.
    direction: view.direction === 'new' ? 'flat' : view.direction,
    srLabel: `전년 대비 ${view.srLabel}`,
  }
}

/**
 * 2단계: 주요 지표 패널과 연도별 상세.
 *
 * 패널에서 **답은 하나**다 — 전국순위만 크다(설계 §5). 나머지 셋은 그 답을 받치는
 * 숫자라 한 단 작다. 위쪽 4px 주홍 띠는 "이 페이지에서 가장 중요한 숫자 묶음" 이라는
 * 표시라 2단계에서 여기 하나다. 캡션의 대학 수는 **그 해의 수를 아는 경우에만** 붙인다:
 * 데이터셋은 최신 연도의 대학 수만 주므로, 다른 해를 기준으로 보고 있으면
 * 숫자를 지어내지 않고 뺀다.
 *
 * 표가 다시 생긴 자리다. 원본은 `dataframe` 으로 연도별 수치를 보여줬는데
 * 이관 후에는 차트의 `sr-only` 표만 남아, **눈으로 보는 사용자는 값을 짚어
 * 읽을 방법이 없었다.** 보고서에 실릴 숫자를 확인하는 단계이므로 표가
 * 카드보다 중요하다.
 */
export function Step2Metrics({ state, dataset }: StepProps) {
  const { stats } = state
  if (!stats) return null

  const year = stats.year
  const point = stats.trend[String(year)]
  const rank = stats.rankChanges[String(year)]
  const yoy = stats.yoy.target

  // 정렬 순서를 가정하지 않는다 — 최신 연도는 최댓값이다.
  const latestYear = dataset ? Math.max(...dataset.years) : null
  const scopeCaption =
    `${year}년 공시 · 사립 등재교 기준` +
    (dataset && year === latestYear ? ` · ${dataset.universityCount}개교` : '')
  const yearCount = Object.keys(stats.trend).length

  return (
    <div className="flex flex-col gap-[var(--spacing-6)]">
      <div className="flex flex-col gap-[var(--spacing-2)]">
        {/* 네 칸을 선으로만 나눈 패널. 휴대폰은 2×2, 그 위는 1×4. 선은 부모가 긋는다. */}
        <Card
          variant="panel"
          ariaLabel="주요 지표"
          bodyClassName="
            grid grid-cols-2 p-0 md:grid-cols-4
            [&>*]:border-[var(--border-subtle)]
            [&>:nth-child(even)]:border-l [&>:nth-child(n+3)]:border-t
            md:[&>*+*]:border-l md:[&>:nth-child(n+3)]:border-t-0
          "
        >
          <MetricCard
            label="전국순위"
            size="answer"
            value={point?.nationalRank != null ? String(point.nationalRank) : null}
            unit="위"
            caption={scopeCaption}
            delta={rank ? rankDelta('전국순위', rank.nationalRankDelta) : undefined}
          />
          <MetricCard
            label="권역순위"
            value={point?.regionalRank != null ? String(point.regionalRank) : null}
            unit="위"
            caption={stats.regionName}
            delta={rank ? rankDelta('권역순위', rank.regionalRankDelta) : undefined}
          />
          <MetricCard
            label="1인당논문수"
            value={point ? point.perCapita.toFixed(4) : null}
            unit="편"
            caption={`${year}년 공시`}
            delta={perCapitaDelta(yoy)}
          />
          <MetricCard
            label="전임교원수"
            value={point ? point.faculty.toLocaleString('ko-KR') : null}
            unit="명"
            caption={`${year}년 공시`}
          />
        </Card>

        {/* 전국순위의 모집단. 서버 문장 그대로 — 화면이 바꿔 말하지 않는다(V14). */}
        {dataset && (
          <p className="m-0 text-meta text-[var(--text-muted)]">{dataset.nationalRankScopeNote}</p>
        )}
      </div>

      <Card
        // 제목은 **실제로 표에 들어간 해**에서 뽑는다. stats.years 는 "고른
        // 연도" 라 대상 대학에 그 해 데이터가 있는지와 무관하다 — 제주국제대는
        // 2016~2025 뿐이라 11개년을 골라도 표는 10행이다(134개교 중 7곳이
        // 전 연도를 갖고 있지 않다). 개수를 박아 두면 그 순간 제목이 거짓이 된다.
        title={`연도별 수치 · ${yearCount}개년`}
        description="보고서 표에 들어가는 값입니다. 소수 넷째 자리까지 그대로 실립니다."
        bodyClassName="p-0"
      >
        <p
          className="
            m-0 border-b border-[var(--border-subtle)] px-[var(--spacing-3)]
            py-[var(--spacing-2)] text-meta text-[var(--text-muted)]
          "
        >
          자료 {year}년 8월 정보공시 · 단위 편·명
        </p>
        <YearTable
          trend={stats.trend}
          averages={stats.averages}
          rankChanges={stats.rankChanges}
          university={stats.university}
          regionName={stats.regionName}
          baseYear={year}
        />
        <p
          className="
            m-0 border-t border-[var(--border-subtle)] px-[var(--spacing-3)]
            py-[var(--spacing-2)] text-meta text-[var(--text-muted)]
          "
        >
          1인당논문수는 SCI급·SCOPUS 학술지 논문의 환산 편수를 전임교원수로 나눈 값입니다.
        </p>
      </Card>
    </div>
  )
}
