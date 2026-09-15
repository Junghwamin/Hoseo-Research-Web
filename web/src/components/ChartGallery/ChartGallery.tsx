import { useState } from 'react'

import { chartUrl, CHART_TITLES, type ChartKind } from '../../api/client'
import { cn } from '../../lib/cn'

export interface ChartGalleryProps {
  readonly university: string
  readonly year: number
  readonly regionName: string | null
  readonly compareGroup: readonly string[] | null
  /** 분석 연도. 추이·순위 차트의 가로축을 정한다. */
  readonly years: readonly number[] | null
  /** 그릴 차트 종류. 화면에서 따로 그리는 것은 빼고 넘긴다. */
  readonly kinds: readonly ChartKind[]
}

/**
 * 서버가 그린 차트.
 *
 * **여기 보이는 그림이 Word 보고서에 그대로 들어간다.** 원본 Streamlit 판은
 * 3단계에서 5종을 보여주며 "보고서에 그대로 삽입됩니다" 라고 안내했고 실제로
 * 같은 PNG 를 썼다. 화면을 recharts 로 따로 그리면 사용자가 확인한 그림과
 * 문서에 실리는 그림이 갈라진다 — 확인 단계의 의미가 없어진다.
 *
 * `<img src>` 로 받는다. fetch 로 받아 objectURL 을 만들면 브라우저 캐시를
 * 우회해서, 단계를 오갈 때마다 matplotlib 이 다시 돈다.
 */
export function ChartGallery({
  university,
  year,
  regionName,
  compareGroup,
  years,
  kinds,
}: ChartGalleryProps) {
  return (
    // 한 줄에 셋이 들어가면 축 글자가 읽히지 않는다. matplotlib 이 그린
    // 고정 크기 그림이라 줄어드는 만큼 글자도 줄어든다.
    <div className="grid grid-cols-[repeat(auto-fit,minmax(26rem,1fr))] gap-[var(--spacing-4)]">
      {kinds.map((kind) => (
        <ServerChart
          key={kind}
          kind={kind}
          university={university}
          year={year}
          regionName={regionName}
          compareGroup={compareGroup}
          years={years}
        />
      ))}
    </div>
  )
}

function ServerChart({
  kind,
  university,
  year,
  regionName,
  compareGroup,
  years,
}: {
  kind: ChartKind
  university: string
  year: number
  regionName: string | null
  compareGroup: readonly string[] | null
  years: readonly number[] | null
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  // 그림을 결정하는 입력을 하나도 빠뜨리지 않는다. 빠뜨린 것이 있으면
  // 화면과 Word 가 갈라진다 — 비교군에서 실제로 났던 사고다.
  const src = chartUrl(kind, { university, year, region: regionName, compareGroup, years })
  const title = CHART_TITLES[kind]

  return (
    <figure
      data-testid={`chart-${kind}`}
      className="
        m-0 flex flex-col gap-[var(--spacing-2)]
        rounded-[var(--radius-md)] border border-[var(--border-subtle)]
        p-[var(--spacing-3)]
      "
    >
      <figcaption className="text-sm font-medium text-[var(--text-primary)]">
        {title}
      </figcaption>

      {status === 'error' ? (
        <p role="alert" className="m-0 py-[var(--spacing-5)] text-sm text-[var(--color-down)]">
          차트를 그리지 못했다. 보고서에도 이 그림은 빠진다.
        </p>
      ) : (
        <img
          src={src}
          // alt 는 "차트" 가 아니라 **무엇에 대한 그림인지**를 적는다.
          // 그림을 못 보는 사람에게 "차트 이미지" 는 아무 정보가 아니다.
          alt={`${university} ${year}년 ${title}`}
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('error')}
          className={cn(
            'w-full rounded-[var(--radius-sm)]',
            // 로딩 중에도 자리를 잡아 둔다. 5장이 차례로 들어오면서
            // 화면이 계속 튀면 읽을 수가 없다.
            status === 'loading' && 'min-h-[12rem] bg-[var(--surface-sunken)]',
          )}
        />
      )}

      {status === 'loading' && (
        <p className="m-0 text-xs text-[var(--text-muted)]">그리는 중…</p>
      )}
    </figure>
  )
}
