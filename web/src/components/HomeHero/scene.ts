import {
  Color,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'

/**
 * 홈 화면 장식용 3D 오브젝트.
 *
 * React Three Fiber 대신 three.js 를 직접 쓴다. R3F 9.7 의 peer 가
 * `react >=19 <19.3` 인데 이 프로젝트는 19.3 이고, 무엇보다 번들 예산이
 * 빠듯하다(§번들 예산 가드). 장식 하나에 R3F + drei 를 얹을 이유가 없다.
 *
 * `three` 는 필요한 클래스만 named import 한다 — `import * as THREE` 로
 * 받으면 트리셰이킹이 죽어 라이브러리 전체가 번들에 들어간다.
 */

export interface SceneHandle {
  /** 렌더 루프를 멈춘다. 뷰포트 밖이거나 탭이 가려졌을 때. */
  readonly pause: () => void
  readonly resume: () => void
  /** GPU 자원을 반납한다. 안 하면 컨텍스트가 새고, 브라우저 상한에 걸린다. */
  readonly dispose: () => void
  readonly resize: () => void
}

/**
 * 토큰에서 색을 읽는다.
 *
 * 폴백 색을 여기 적지 않는다(§12-1). 하드코딩한 색은 테마가 바뀔 때 혼자
 * 남아 어긋나고, 그걸 잡아줄 사람이 없다. 토큰을 못 읽으면 `null` 을 주고
 * 호출부가 3D 를 포기한다 — 장식이므로 색이 틀린 채 도는 것보다 낫다.
 * (tokens.css 는 항상 먼저 로드되므로 실제로는 도달하지 않는 경로다.)
 */
function readToken(name: string): string | null {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || null
}

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    // 저사양 기기에서 고해상도 렌더는 프레임을 잡아먹는다. 장식이므로
    // 선명함보다 부드러움을 택한다.
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new Scene()
  const camera = new PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 0, 6)

  // 히어로는 사진 위다. 밝은 색을 쓴다 — `--accent` 는 흰 지면용 딥그린이라
  // 어두운 사진 위에서 초록 얼룩으로만 보인다.
  const figureToken = readToken('--color-brand-200')
  if (!figureToken) {
    // 색을 모르면 그리지 않는다. 호출부가 정적 대체물로 넘어간다.
    renderer.dispose()
    throw new Error('--color-brand-200 토큰을 읽지 못했다')
  }

  const mesh = new Mesh(
    // detail=1 이면 면이 320개다. 장식에 충분하고 저사양에서도 가볍다.
    new IcosahedronGeometry(2, 1),
    // **와이어프레임이다.** 채워진 면은 사진 위에서 덩어리로 뭉쳐 보여
    // 의도한 장식이 아니라 렌더 오류처럼 읽힌다. 선으로 두면 사진이 비치고
    // 그래픽으로 읽힌다.
    new MeshBasicMaterial({
      color: new Color(figureToken),
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    }),
  )
  scene.add(mesh)

  // 조명을 두지 않는다. MeshBasicMaterial 은 빛을 받지 않으므로 계산만 늘고
  // 화면은 그대로다.

  function resize() {
    const parent = canvas.parentElement
    if (!parent) return
    const { clientWidth: w, clientHeight: h } = parent
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  let frame = 0
  let running = false
  let last = 0

  function tick(now: number) {
    if (!running) return
    // 프레임 간격으로 회전량을 정한다. 시간 기준이라 기기가 느려도
    // 같은 속도로 돌고, 빨라도 튀지 않는다.
    const dt = last === 0 ? 16 : Math.min(now - last, 50)
    last = now
    mesh.rotation.x += dt * 0.00012
    mesh.rotation.y += dt * 0.00018
    renderer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }

  function resume() {
    if (running) return
    running = true
    last = 0
    frame = requestAnimationFrame(tick)
  }

  function pause() {
    running = false
    cancelAnimationFrame(frame)
  }

  function dispose() {
    pause()
    mesh.geometry.dispose()
    ;(mesh.material as MeshBasicMaterial).dispose()
    // 컨텍스트를 명시적으로 잃어야 GPU 자원이 즉시 반납된다. 브라우저는
    // 동시 WebGL 컨텍스트 수에 상한이 있어서, 흘리면 다음 캔버스가 못 뜬다.
    renderer.dispose()
    renderer.forceContextLoss()
  }

  resume()
  return { pause, resume, dispose, resize }
}
