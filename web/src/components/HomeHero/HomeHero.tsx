import { useEffect, useRef, useState } from 'react'

import { decideHeroMode, readEnvironment, type HeroMode } from './capability'

export interface HomeHeroProps {
  readonly title: string
  readonly subtitle: string
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
export function HomeHero({ title, subtitle }: HomeHeroProps) {
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
      className="
        relative overflow-hidden
        rounded-[var(--radius-xl)] border border-[var(--border-subtle)]
        bg-[var(--surface-raised)]
        px-[var(--spacing-6)] py-[var(--spacing-7)]
      "
    >
      {/* 장식 레이어. 보조 기술에서는 감춘다 — 읽어봐야 의미가 없다. */}
      {mode === 'three' ? (
        <canvas
          ref={canvasRef}
          data-testid="hero-canvas"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-60"
        />
      ) : (
        <div
          data-testid="hero-static"
          aria-hidden="true"
          className="
            absolute inset-0
            bg-[radial-gradient(60%_80%_at_80%_20%,var(--accent-soft),transparent_70%)]
          "
        />
      )}

      <div className="relative flex flex-col gap-[var(--spacing-3)]">
        <h1 className="m-0 text-3xl font-bold text-[var(--text-primary)]">{title}</h1>
        <p className="m-0 max-w-[36rem] text-sm text-[var(--text-secondary)]">
          {subtitle}
        </p>
      </div>
    </section>
  )
}
