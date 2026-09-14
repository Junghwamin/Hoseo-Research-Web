import type { ReactNode } from 'react'

export interface MediaBandProps {
  readonly eyebrow?: string
  readonly title: string
  readonly children?: ReactNode
  /**
   * 배경 사진. **번들된 파일만 쓴다**(`scripts/fetch_media.py` 가 받아 둔다).
   *
   * 설치본은 오프라인이라 CDN 주소를 쓰면 구간이 통째로 빈다.
   */
  readonly imageSrc?: string
}

/**
 * 사진을 깐 전체 폭 구간.
 *
 * 화면이 카드와 표로만 이어지면 어디가 끝인지 모른다. 사진 구간 하나가
 * 리듬을 만든다 — 다만 **한 페이지에 한 번만** 쓴다. 여러 번 쓰면 리듬이
 * 아니라 얼룩이다.
 *
 * `HomeHero` 와 나눈 이유: 히어로는 3D·지연 로딩·성능 판정이 얽혀 있고
 * 이건 순수 표시다. 한 컴포넌트에 넣으면 둘 중 하나를 고칠 때마다 다른
 * 하나를 깨뜨릴 위험을 진다.
 */
export function MediaBand({ eyebrow, title, children, imageSrc }: MediaBandProps) {
  return (
    <section
      // 사진 위 흰 글자다. 테마와 무관하게 이 구간만 항상 어둡다.
      className="relative overflow-hidden bg-[var(--surface-inverse)]"
      aria-label={title}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          // 장식이다. 이 사진이 전하는 정보는 없다.
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[image:var(--scrim-band)]"
      />

      <div
        className="
          relative mx-auto flex max-w-[var(--container-content)] flex-col
          gap-[var(--spacing-3)]
          px-[var(--spacing-5)] py-[var(--spacing-8)]
        "
      >
        {eyebrow && (
          <span className="text-eyebrow font-semibold uppercase text-[var(--color-brand-200)]">
            {eyebrow}
          </span>
        )}
        <h2 className="m-0 max-w-[24ch] text-title font-bold text-[var(--color-ink-0)]">
          {title}
        </h2>
        {children && (
          <div className="max-w-[var(--container-prose)] text-[var(--color-ink-200)]">
            {children}
          </div>
        )}
      </div>
    </section>
  )
}
