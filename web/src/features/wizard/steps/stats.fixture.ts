import type { DatasetInfo, StatsResponse } from '../../../api/client'

/**
 * 단계 테스트용 통계 응답. 호서대 2025→2026 의 실제 모양을 닮게 했다 —
 * 1인당논문수 0.1182 → 0.1297(+9.7%), 전국순위 77 → 71(+6계단).
 */
const trend = {
  '2025': { papers: 120, faculty: 1015, perCapita: 0.1182, regionalRank: 19, nationalRank: 77 },
  '2026': { papers: 132, faculty: 1018, perCapita: 0.1297, regionalRank: 17, nationalRank: 71 },
}
const averages = {
  '2025': { national: 0.31, regional: 0.22, compareGroup: 0.2 },
  '2026': { national: 0.32, regional: 0.23, compareGroup: 0.21 },
}
const rankChanges = {
  '2025': { regionalRank: 19, nationalRank: 77, regionalRankDelta: null, nationalRankDelta: null },
  '2026': { regionalRank: 17, nationalRank: 71, regionalRankDelta: 2, nationalRankDelta: 6 },
}

/** 서버가 `/api/data` 에 싣는 범위 문장. 화면은 이 원문을 그대로 보인다(V14). */
export const SCOPE_NOTE =
  '전국순위는 대학알리미에 등재된 사립 133개교 기준입니다. 국공립대·과기원은 집계에 포함되지 않습니다.'

export function makeStats(overrides: Partial<StatsResponse> = {}): StatsResponse {
  return {
    university: '호서대학교',
    regionName: '충청권',
    year: 2026,
    years: [2025, 2026],
    trend,
    averages,
    rankChanges,
    compare: [],
    compareGroup: ['호서대학교'],
    compareGroupNote: null,
    dataVersion: 1,
    overlayHash: null,
    yoy: {
      top: [],
      bottom: [],
      target: { name: '호서대학교', changeRate: 9.7, baseValue: 0.1297, compareValue: 0.1182 },
    },
    ...overrides,
  } as unknown as StatsResponse
}

export function makeDataset(overrides: Partial<DatasetInfo> = {}): DatasetInfo {
  return {
    years: [2024, 2025, 2026],
    regions: ['충청권'],
    universities: ['호서대학교', '단국대학교'],
    universityCount: 133,
    nationalRankScopeNote: SCOPE_NOTE,
    overlayYears: [],
    ...overrides,
  } as DatasetInfo
}
