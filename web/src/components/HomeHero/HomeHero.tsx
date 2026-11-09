import type { DatasetInfo } from '../../api/client'
import { Button } from '../../design/ui'
import { DataPanel } from './DataPanel'

export interface HomeHeroProps {
  /** `/api/data`. 아직 못 받았으면 null — 패널은 스켈레톤, 띠의 연도 항목은 생략한다. */
  readonly dataset: DatasetInfo | null
  /** `/api/data` 를 받지 못한 이유. 패널이 오류와 「다시 시도」를 보인다. */
  readonly datasetError?: string | null
  /** 패널의 「다시 시도」. */
  readonly onRetry?: () => void
  /** 「분석 시작」(휴대폰 전용). 1단계 입력으로 내려가 포커스를 준다. */
  readonly onStart: () => void
}

const EYEBROW = '대학알리미 공시 · 전임교원 연구실적'
const LEAD =
  '대학알리미가 공시한 전임교원 1인당 SCI급·SCOPUS 논문 수로 사립대 안에서 우리 대학의 ' +
  '자리를 확인하고, 권역·비교군과 견준 결과를 그대로 Word 보고서로 내려받습니다.'

/**
 * 진입 화면 히어로 — 활자와 숫자 패널, 2열 비대칭.
 *
 * 왼쪽은 질문 하나(표제)와 자료의 출처·범위, 오른쪽은 「자료 현황」 패널이다
 * (설계 §4, DESIGN.md §4). 가운데 정렬 히어로·사진·3D 는 없다 — 다른 대학
 * 캠퍼스 사진은 소속을 오해시키고, 장식 하나에 127KB 를 받은 적이 있다.
 *
 * 주홍은 여기서 두 군데다: 표제의 「몇 번째」와 패널의 위쪽 띠. 그 밖의 장식
 * (`hero-static`)은 패널 뒤로 어긋나게 깔리는 격자 한 장이고 선 색 토큰만 쓴다.
 *
 * 띠와 패널의 숫자(대학 수·연도·권역 수)는 전부 서버에서 온다. 상수로 박으면
 * 8월 공시가 갱신되는 순간 거짓이 된다. 데이터가 아직 없으면 연도 항목을 비워
 * 두지 않고 빼서, 콜드 스타트 중에도 "undefined년" 같은 글자가 보이지 않게 한다.
 */
export function HomeHero({ dataset, datasetError, onRetry, onStart }: HomeHeroProps) {
  const years = dataset?.years ?? []
  const first = years.length > 0 ? Math.min(...years) : null
  const last = years.length > 0 ? Math.max(...years) : null

  return (
    <section
      aria-label="소개"
      className="relative overflow-hidden border-b border-[var(--border-subtle)]"
    >
      <div
        className="
          mx-auto grid max-w-[var(--container-content)] gap-[var(--spacing-7)]
          px-[var(--spacing-5)] py-[var(--spacing-7)] md:py-[var(--spacing-8)]
          lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-[2.625rem]
        "
      >
        <div className="flex max-w-[var(--container-prose)] flex-col gap-[var(--spacing-5)]">
          <p className="eyebrow m-0 text-[var(--text-secondary)]">{EYEBROW}</p>

          {/* 표제는 Pretendard 700 이다. 강조 단어만 주홍 — span 이 끼어도 접근성
              이름은 한 줄 그대로여야 한다(e2e 가 이름으로 찾는다). */}
          <h1 className="m-0 text-display font-bold text-[var(--text-primary)]">
            우리 대학은 <span className="text-[var(--accent)]">몇 번째</span>인가
          </h1>

          <p className="m-0 text-lead text-[var(--text-secondary)]">{LEAD}</p>

          {/* 휴대폰에서는 1단계가 첫 화면 아래에 있다. 큰 화면에서는 보이므로 버튼을
              두지 않는다 — 잉크 사각은 한 화면에 하나다. */}
          <Button variant="primary" size="lg" className="self-start md:hidden" onClick={onStart}>
            분석 시작
          </Button>

          <ul
            aria-label="자료 범위"
            className="
              m-0 flex list-none flex-wrap gap-x-[var(--spacing-5)] gap-y-[var(--spacing-2)]
              p-0 text-meta text-[var(--text-muted)]
            "
          >
            <li>출처 대학알리미 「7-가. 전임교원의 연구 실적」</li>
            {first !== null && last !== null && <li>{`공시 ${first}–${last}년`}</li>}
            <li>매년 8월 공시 반영</li>
          </ul>
        </div>

        <div className="relative">
          {/* 장식 — 패널 뒤로 오른쪽·아래로 어긋난 격자 한 장. 하드 오프셋 그림자의
              격자판이다. 큰 화면에서만 보이되 DOM 에는 늘 있다(e2e 계약). */}
          <div
            data-testid="hero-static"
            aria-hidden="true"
            className="
              pointer-events-none absolute -right-[var(--spacing-5)] -bottom-[var(--spacing-5)]
              left-[var(--spacing-5)] top-[var(--spacing-5)] hidden
              bg-[linear-gradient(var(--border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--border-subtle)_1px,transparent_1px)]
              bg-[size:var(--grid-size)_var(--grid-size)] lg:block
            "
          />
          <DataPanel dataset={dataset} error={datasetError} onRetry={onRetry} />
        </div>
      </div>
    </section>
  )
}
