// 이 폴더의 공개 면(public surface).
//
// 바깥에서는 이 파일만 import 한다. 내부 파일 경로를 직접 가리키면,
// 파일을 쪼개거나 이름을 바꾸는 순간 호출부가 전부 깨진다.

export { CompareTable } from './CompareTable'
export { formatFaculty, formatPapers, formatPerCapita, formatRank } from './transform'
export type { CompareRow, CompareTableProps } from './types'
