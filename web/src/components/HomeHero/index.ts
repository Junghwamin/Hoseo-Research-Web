// 이 폴더의 공개 면(public surface).
//
// 바깥에서는 이 파일만 import 한다. 내부 파일 경로를 직접 가리키면,
// 파일을 쪼개거나 이름을 바꾸는 순간 호출부가 전부 깨진다.
//
// **`./scene` 은 일부러 내보내지 않는다.** three.js 를 끌고 오는 모듈이라,
// 배럴이 내보내면 그것을 쓰지 않는 화면의 초기 번들에도 딸려 들어간다.
// HomeHero 가 실행 중에 dynamic import 로만 부른다.

export { HomeHero } from './HomeHero'
export type { HomeHeroProps } from './HomeHero'
export { decideHeroMode, readEnvironment } from './capability'
export type { HeroMode, HeroEnvironment } from './capability'
