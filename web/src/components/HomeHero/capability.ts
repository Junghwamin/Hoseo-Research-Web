/**
 * 3D 히어로를 실제로 그릴지 판단한다.
 *
 * 판단을 컴포넌트에서 떼어낸 이유는 WebGL 을 jsdom 에서 렌더할 수 없기
 * 때문이다. 순수 함수로 두면 "언제 3D 를 포기하는가" 를 정확히 검사할 수 있다.
 *
 * 이 화면은 **장식**이다. 조금이라도 의심스러우면 정적 대체물로 간다 —
 * 분석 도구의 첫인상이 버벅이는 애니메이션이면 안 하느니만 못하다.
 */

export type HeroMode = 'three' | 'static'

export interface HeroEnvironment {
  /** 사용자가 모션을 줄이겠다고 했는가. */
  readonly prefersReducedMotion: boolean
  /** WebGL 컨텍스트를 만들 수 있는가. */
  readonly hasWebGL: boolean
  /** 논리 CPU 수. 알 수 없으면 `undefined`. */
  readonly cores: number | undefined
  /** 기기 메모리(GB). 알 수 없으면 `undefined`. */
  readonly memoryGb: number | undefined
  /** 뷰포트 너비(px). 좁은 화면에서는 히어로가 본문을 밀어낸다. */
  readonly viewportWidth: number
}

/** 이 아래로는 3D 를 그리지 않는다. */
const MIN_CORES = 4
const MIN_MEMORY_GB = 4
const MIN_WIDTH = 640

/**
 * 판단 규칙.
 *
 * `cores`·`memoryGb` 가 `undefined` 인 것은 **저사양이라는 뜻이 아니다** —
 * Safari 는 `deviceMemory` 를 아예 제공하지 않는다. 모른다는 이유로 3D 를
 * 끄면 맥 사용자 전체가 정적 화면을 본다. 값이 있을 때만 비교한다.
 */
export function decideHeroMode(env: HeroEnvironment): HeroMode {
  if (env.prefersReducedMotion) return 'static'
  if (!env.hasWebGL) return 'static'
  if (env.viewportWidth < MIN_WIDTH) return 'static'
  if (env.cores !== undefined && env.cores < MIN_CORES) return 'static'
  if (env.memoryGb !== undefined && env.memoryGb < MIN_MEMORY_GB) return 'static'
  return 'three'
}

/** 브라우저에서 환경을 읽는다. 값을 못 읽어도 던지지 않는다. */
export function readEnvironment(): HeroEnvironment {
  return {
    prefersReducedMotion:
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    hasWebGL: detectWebGL(),
    cores: navigator.hardwareConcurrency || undefined,
    memoryGb: (navigator as { deviceMemory?: number }).deviceMemory,
    viewportWidth: window.innerWidth,
  }
}

/**
 * WebGL 을 쓸 수 있는가.
 *
 * 컨텍스트를 만들어 보는 것이 유일하게 믿을 만한 방법이다. 만든 컨텍스트는
 * 즉시 버린다 — 브라우저마다 동시 컨텍스트 수 상한이 있어서 흘리면 진짜
 * 캔버스가 컨텍스트를 못 얻는다.
 */
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    if (!gl) return false
    const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return true
  } catch {
    return false
  }
}
