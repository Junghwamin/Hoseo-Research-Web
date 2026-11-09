import { useState } from 'react'

import { CHART_TITLES, type ChartKind } from '../../api/client'
import { Button, Pending } from '../../design/ui'
import { cn } from '../../lib/cn'
import { useChartImage } from './useChartImage'

export interface ChartGalleryProps {
  readonly university: string
  readonly year: number
  readonly regionName: string | null
  readonly compareGroup: readonly string[] | null
  /** 분석 연도. 추이·순위 차트의 가로축을 정한다. */
  readonly years: readonly number[] | null
  /** 데이터 판. 전처리 뒤 브라우저가 옛 PNG 를 계속 쓰지 않게 한다. */
  readonly dataVersion: number
  /** 그릴 차트 종류. Word 에 실리는 순서대로 넘긴다. */
  readonly kinds: readonly ChartKind[]
  /** 큰 화면에서 두 칸을 차지하는 그림. 추이처럼 가로로 긴 그림 하나. */
  readonly featured?: ChartKind
  /**
   * 브라우저가 든 추가 데이터(overlay)의 키. 없으면(`null`/생략) 지금까지처럼
   * GET `<img src>` 로 받고, 있으면 POST 로 받아 objectURL 을 쓴다 — 추가 데이터는
   * 요청 본문으로만 서버에 닿기 때문이다. 키가 바뀌면 그려 둔 그림을 전부 버린다.
   */
  readonly overlayKey?: string | null
}

/**
 * 종류별 가로세로 비율. `core/chart_generator.py` 의 figsize 와 같은 토큰이다.
 * 그림이 오기 전에 자리를 잡아 두지 않으면 5장이 차례로 들어오며 화면이 튄다.
 */
const ASPECT: Record<ChartKind, string> = {
  trend: 'aspect-[var(--chart-aspect-trend)]',
  bar: 'aspect-[var(--chart-aspect-bar)]',
  avg: 'aspect-[var(--chart-aspect-avg)]',
  rank: 'aspect-[var(--chart-aspect-rank)]',
  compare: 'aspect-[var(--chart-aspect-compare)]',
}

/**
 * 서버가 그린 차트.
 *
 * **여기 보이는 그림이 Word 보고서에 그대로 들어간다.** 원본 Streamlit 판은
 * 3단계에서 5종을 보여주며 "보고서에 그대로 삽입됩니다" 라고 안내했고 실제로
 * 같은 PNG 를 썼다. 화면을 recharts 로 따로 그리면 사용자가 확인한 그림과
 * 문서에 실리는 그림이 갈라진다 — 확인 단계의 의미가 없어진다.
 *
 * 기본 데이터만 쓸 때는 `<img src>` 로 받는다. fetch 로 받아 objectURL 을 만들면
 * 브라우저 캐시를 우회해서, 단계를 오갈 때마다 matplotlib 이 다시 돈다. 브라우저가
 * 든 추가 데이터가 있을 때만 POST 로 받는다(`useChartImage`).
 *
 * 그림은 흰 매트 위에 놓는다 — 다크 테마에서도 흰색이다(`--chart-matte`).
 * 서버 PNG 의 배경이 흰색이라, 어두운 지면에 바로 올리면 네모난 흰 덩어리가
 * 되고 반전하면 문서와 다른 그림을 검토하게 된다. 매트의 1px 선은 헤어라인 —
 * 프레임이 아니다. 구획의 선은 섹션이 긋는다.
 */
export function ChartGallery({
  university,
  year,
  regionName,
  compareGroup,
  years,
  dataVersion,
  kinds,
  featured,
  overlayKey = null,
}: ChartGalleryProps) {
  return (
    // 한 줄에 둘. 셋이 들어가면 축 글자가 읽히지 않는다 — matplotlib 이 그린
    // 고정 크기 그림이라 줄어드는 만큼 글자도 줄어든다.
    <div className="grid grid-cols-1 gap-[var(--spacing-6)] lg:grid-cols-2">
      {kinds.map((kind, index) => (
        <ServerChart
          key={kind}
          kind={kind}
          // Word 에 실리는 순서. 캡션의 번호가 문서의 그림 순서와 같아야 한다.
          order={index + 1}
          featured={kind === featured}
          university={university}
          year={year}
          regionName={regionName}
          compareGroup={compareGroup}
          years={years}
          dataVersion={dataVersion}
          overlayKey={overlayKey}
        />
      ))}
    </div>
  )
}

type ImgStatus = 'loading' | 'ready' | 'error'

function ServerChart({
  kind,
  order,
  featured,
  university,
  year,
  regionName,
  compareGroup,
  years,
  dataVersion,
  overlayKey,
}: {
  kind: ChartKind
  order: number
  featured: boolean
  university: string
  year: number
  regionName: string | null
  compareGroup: readonly string[] | null
  years: readonly number[] | null
  dataVersion: number
  overlayKey: string | null
}) {
  // 그림을 결정하는 입력을 하나도 빠뜨리지 않는다. 빠뜨린 것이 있으면
  // 화면과 Word 가 갈라진다 — 비교군에서 실제로 났던 사고다.
  const image = useChartImage(
    kind,
    { university, year, region: regionName, compareGroup, years, dataVersion },
    overlayKey,
  )
  // 받은 뒤 <img> 가 실제로 그려졌는가. 훅은 「받았는가」 까지만 안다.
  const [imgStatus, setImgStatus] = useState<ImgStatus>('loading')
  const status: ImgStatus = image.status === 'ready' ? imgStatus : image.status
  const title = CHART_TITLES[kind]

  function retry() {
    setImgStatus('loading')
    image.retry()
  }

  return (
    <figure
      data-testid={`chart-${kind}`}
      className={cn('m-0 flex min-w-0 flex-col gap-[var(--spacing-2)]', featured && 'lg:col-span-2')}
    >
      {/* 번호는 Word 의 그림 순서다 — 모노 아이브로. 제목은 본문 글꼴이다. */}
      <figcaption className="flex items-baseline gap-[var(--spacing-3)] text-heading font-semibold text-[var(--text-primary)]">
        <span className="eyebrow-mono text-[var(--text-secondary)]">
          {String(order).padStart(2, '0')}
        </span>{' '}
        {title}
      </figcaption>

      {status === 'error' ? (
        <div
          role="alert"
          className="
            flex flex-wrap items-center justify-between gap-[var(--spacing-3)]
            border border-[var(--color-down)] bg-[var(--color-down-soft)]
            p-[var(--spacing-4)] text-body text-[var(--color-down)]
          "
        >
          <p className="m-0">차트를 그리지 못했습니다. 이대로면 보고서에서도 빠집니다.</p>
          <Button size="sm" onClick={retry}>
            다시 그리기
          </Button>
        </div>
      ) : (
        <div className="relative border border-[var(--border-subtle)] bg-[var(--chart-matte)] p-[var(--spacing-3)]">
          {image.src !== null ? (
            <img
              src={image.src}
              // alt 는 "차트" 가 아니라 **무엇에 대한 그림인지**를 적는다.
              // 그림을 못 보는 사람에게 "차트 이미지" 는 아무 정보가 아니다.
              alt={`${university} ${year}년 ${title}`}
              onLoad={() => setImgStatus('ready')}
              onError={() => setImgStatus('error')}
              className={cn('block w-full', ASPECT[kind])}
            />
          ) : (
            // POST 로 받는 동안 — 그림 자리를 같은 비율로 비워 둔다. 레이아웃이 튀지 않는다.
            <div aria-hidden="true" className={cn('w-full', ASPECT[kind])} />
          )}
          {status === 'loading' && (
            <Pending
              className="absolute inset-[var(--spacing-3)] min-h-0"
              label={`${title}를 그리는 중`}
            />
          )}
        </div>
      )}
    </figure>
  )
}
