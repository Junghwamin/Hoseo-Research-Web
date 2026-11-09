import type { DatasetInfo } from '../../api/client'
import { Button, Card, Pending } from '../../design/ui'

export interface DataPanelProps {
  /** `/api/data`. 아직 못 받았으면 null — 숫자 자리에 스켈레톤을 둔다. */
  readonly dataset: DatasetInfo | null
  /** 받지 못한 이유. 있으면 숫자 대신 오류와 「다시 시도」를 보인다. */
  readonly error?: string | null
  readonly onRetry?: () => void
}

/**
 * 「자료 현황」 — 홈 히어로 오른쪽의 패널.
 *
 * 템플릿에는 없고 쓰는 사람만 넣을 수 있는 한 조각이다(설계 §4). 계약은 하나:
 * **여기 적힌 숫자는 전부 `/api/data` 응답이다.** 대학 수·연도·권역 수를 상수로
 * 박으면 8월 공시가 갱신되는 순간 거짓이 된다. 응답이 오기 전에는 숫자 자리만
 * 스켈레톤이고 틀과 제목은 바로 선다 — 레이아웃이 튀지 않는다.
 *
 * 위쪽 4px 주홍 띠(`variant="panel"`)는 "이 페이지에서 가장 중요한 숫자 묶음"
 * 이라는 표시라 홈에서 여기 하나다. 제목은 `h2` 다 — 히어로의 `h1` 바로 아래
 * 단계라서 `Card` 의 `title`(h3)을 쓰면 표제 순서가 건너뛴다.
 *
 * `role="status"` 는 어디에도 두지 않는다. 콤보박스의 status 가 페이지의 첫
 * status 로 남아야 하는 e2e 계약이 있다. 오류만 `role="alert"` 다.
 */
export function DataPanel({ dataset, error, onRetry }: DataPanelProps) {
  return (
    <div data-testid="data-panel" className="relative">
      <Card variant="panel" bodyClassName="flex flex-col gap-[var(--spacing-5)]">
        <h2 className="eyebrow m-0 text-[var(--text-secondary)]">자료 현황</h2>
        {error ? (
          <Failure error={error} onRetry={onRetry} />
        ) : dataset ? (
          <Facts dataset={dataset} />
        ) : (
          <Pending label="자료 현황을 불러오는 중" />
        )}
      </Card>
    </div>
  )
}

function Facts({ dataset }: { readonly dataset: DatasetInfo }) {
  // 스키마는 기본값 [] 을 보장하지만(설계 §8), 이 필드를 모르는 옛 서버의 응답이
  // 올 수 있다(설치본·배포 세대가 어긋날 때). 없으면 "추가 데이터 없음" 으로 읽는다.
  const overlayYears: readonly number[] = dataset.overlayYears ?? []
  const years = dataset.years
  // Math.max() 는 빈 배열에서 -Infinity 다. 그 글자가 화면에 찍히게 두지 않는다.
  const latest = years.length > 0 ? Math.max(...years) : null

  const facts: ReadonlyArray<{ readonly label: string; readonly value: number | null }> = [
    { label: '개교', value: dataset.universityCount },
    { label: '개년', value: years.length },
    { label: '권역', value: dataset.regions.length },
    { label: '최신 공시', value: latest },
  ]

  return (
    <>
      <ul
        className="
          m-0 grid list-none grid-cols-2 gap-x-[var(--spacing-4)] gap-y-[var(--spacing-5)]
          p-0 sm:grid-cols-4
        "
      >
        {facts.map((fact) => (
          <li
            key={fact.label}
            className="
              flex flex-col gap-[var(--spacing-2)] border-l border-[var(--border-subtle)]
              pl-[var(--spacing-3)]
            "
          >
            {/* 숫자만 모노다. 라벨까지 걸면 한글이 폴백으로 떨어져 글꼴이 갈라진다. */}
            <span
              className="
                tabular font-[family-name:var(--font-numeric)] text-kpi-sub font-medium
                text-[var(--text-primary)]
              "
            >
              {fact.value ?? '—'}
            </span>
            <span className="eyebrow text-[var(--text-muted)]">{fact.label}</span>
          </li>
        ))}
      </ul>

      {/* 서버 문장 원문. 전국순위의 모집단(등재 사립)을 화면에서 숨기지 않는다(V14). */}
      <p className="m-0 text-meta text-[var(--text-muted)]">{dataset.nationalRankScopeNote}</p>

      {overlayYears.length > 0 && (
        <p data-testid="overlay-note" className="m-0 text-body text-[var(--text-secondary)]">
          {`추가 데이터 ${overlayYears.join('·')}년 · 이 브라우저`}
        </p>
      )}
    </>
  )
}

function Failure({
  error,
  onRetry,
}: {
  readonly error: string
  readonly onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-[var(--spacing-3)]">
      {/* 무엇이 났는지 → 서버가 말한 이유 순서. 입력이 없는 면이라 지울 것도 없다. */}
      <p role="alert" className="m-0 text-body text-[var(--color-down)]">
        {`자료 현황을 불러오지 못했습니다. ${error}`}
      </p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  )
}
