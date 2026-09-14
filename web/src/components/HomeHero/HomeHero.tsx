import { useEffect, useRef, useState } from 'react'

import { decideHeroMode, readEnvironment, type HeroMode } from './capability'

export interface HomeHeroProps {
  readonly title: string
  readonly subtitle: string
  /** 제목 위 작은 라벨. */
  readonly eyebrow?: string
  /**
   * 배경 사진. **번들된 파일만 쓴다**(`scripts/fetch_media.py` 가 받아 둔다).
   *
   * 설치본은 오프라인이라 CDN 주소를 쓰면 히어로가 통째로 빈다.
   */
  readonly imageSrc?: string
  /** 사진 아래에 깔 대체 색. 사진을 못 받으면 이것만 보인다. */
  readonly children?: React.ReactNode
}

/**
 * 진입 화면 히어로.
 *
 * 3D 는 **장식**이다(계획 §5). 분석 화면은 2D 를 유지해 가독성을 지키고,
 * 여기만 연출한다. 그래서 세 가지를 지킨다.
 *
 * 1. **글이 먼저다.** 3D 가 실패해도 제목과 설명은 그대로 읽힌다.
 * 2. **지연 로딩.** three.js 는 초기 번들에 들어가지 않는다 — 홈을 실제로
 *    볼 때만 내려받는다. 번들 예산이 빠듯해서만이 아니라, 장식 때문에
 *    분석 화면의 첫 로딩이 느려지면 본말이 전도되기 때문이다.
 * 3. **의심스러우면 포기한다.** reduced-motion·저사양·좁은 화면·WebGL 부재는
 *    전부 정적 대체물로 간다(capability.ts).
 */
export function HomeHero({
  title,
  subtitle,
  eyebrow,
  imageSrc,
  children,
}: HomeHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<HeroMode>('static')

  useEffect(() => {
    setMode(decideHeroMode(readEnvironment()))
  }, [])

  useEffect(() => {
    if (mode !== 'three') return
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let handle: { pause(): void; resume(): void; dispose(): void; resize(): void } | null =
      null
    const cleanups: Array<() => void> = []

    // three.js 를 여기서만 불러온다. 정적 경로로 간 사용자는 받지 않는다.
    import('./scene')
      .then(({ createScene }) => {
        if (cancelled) return
        // createScene 은 토큰을 못 읽으면 던진다. 아래 catch 가 정적으로 돌린다.
        handle = createScene(canvas)

        const onResize = () => handle?.resize()
        window.addEventListener('resize', onResize)
        cleanups.push(() => window.removeEventListener('resize', onResize))

        // 탭이 가려지면 멈춘다. 안 그러면 보이지도 않는 화면을 계속 그린다.
        const onVisibility = () =>
          document.hidden ? handle?.pause() : handle?.resume()
        document.addEventListener('visibilitychange', onVisibility)
        cleanups.push(() =>
          document.removeEventListener('visibilitychange', onVisibility),
        )

        // 스크롤로 뷰포트를 벗어나도 멈춘다.
        if ('IntersectionObserver' in window) {
          const io = new IntersectionObserver(
            ([entry]) => (entry.isIntersecting ? handle?.resume() : handle?.pause()),
            { threshold: 0 },
          )
          io.observe(canvas)
          cleanups.push(() => io.disconnect())
        }
      })
      .catch(() => {
        // 청크를 못 받았다(오프라인 캐시 문제 등). 장식이 없을 뿐이다.
        if (!cancelled) setMode('static')
      })

    return () => {
      cancelled = true
      for (const fn of cleanups) fn()
      handle?.dispose()
    }
  }, [mode])

  return (
    <section
      aria-label="소개"
      // 사진 위에 흰 글자를 얹는다. 테마와 무관하게 이 구간만 항상 어둡다 —
      // 사진이 배경이면 다크/라이트로 글자색을 바꿀 수가 없다.
      className="relative overflow-hidden bg-[var(--surface-inverse)]"
    >
      {imageSrc && (
        <img
          src={imageSrc}
          // 장식이다. 이 사진이 전하는 정보는 없다 — alt 를 채우면
          // 스크린리더 사용자에게 의미 없는 문장을 읽힌다.
          alt=""
          aria-hidden="true"
          // 히어로는 첫 화면이다. 지연 로딩하면 흰 화면이 먼저 보인다.
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
      )}

      {/* 글 읽히는 대비를 사진에 맡기지 않는다. 사진이 밝은 쪽이 걸리면
          흰 글자가 사라진다. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[image:var(--scrim-hero)]"
      />

      {/* 움직이는 장식. 보조 기술에서는 감춘다 — 읽어봐야 의미가 없다.
          오른쪽에만 둔다. 글 뒤에 깔면 대비가 떨어져 읽기 나빠진다. */}
      {mode === 'three' ? (
        <canvas
          ref={canvasRef}
          data-testid="hero-canvas"
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2
            opacity-90 lg:block
          "
        />
      ) : (
        <div
          data-testid="hero-static"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[image:var(--scrim-hero-glow)]"
        />
      )}

      <div
        className="
          relative mx-auto flex max-w-[var(--container-content)] flex-col
          gap-[var(--spacing-5)]
          px-[var(--spacing-5)] py-[var(--spacing-9)]
        "
      >
        {eyebrow && (
          <span className="text-eyebrow font-semibold uppercase text-[var(--color-brand-200)]">
            {eyebrow}
          </span>
        )}
        {/* 표제는 크게. 지금까지 화면에서 가장 큰 글자가 18px 이라 무엇이
            표제인지 알 수 없었다. */}
        <h1 className="m-0 max-w-[20ch] text-display font-bold text-[var(--color-ink-0)]">
          {title}
        </h1>
        <p className="m-0 max-w-[48ch] text-lead text-[var(--color-ink-200)]">{subtitle}</p>
        {children && <div className="flex flex-wrap gap-[var(--spacing-3)]">{children}</div>}
      </div>
    </section>
  )
}
