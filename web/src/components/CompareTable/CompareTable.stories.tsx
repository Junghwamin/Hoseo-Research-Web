import type { Meta, StoryObj } from '@storybook/react-vite'

import { CompareTable } from './CompareTable'
import type { CompareRow } from './types'

const meta = {
  title: '지표/CompareTable',
  component: CompareTable,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CompareTable>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 2026년 천안·아산 5개 대학 실제 값(`output/충청권_순위.csv`).
 * 논문수는 API 가 소수 둘째 자리로 반올림해 주는 모양 그대로 둔다.
 * 순서도 서버와 같게 1인당논문수 내림차순이다 — 표는 다시 정렬하지 않는다.
 */
const 천안아산5개교: CompareRow[] = [
  {
    name: '순천향대학교',
    faculty: 931,
    papers: 368.77,
    perCapita: 0.3961,
    nationalRank: 26,
    regionalRank: 4,
  },
  {
    name: '선문대학교',
    faculty: 276,
    papers: 69.32,
    perCapita: 0.2512,
    nationalRank: 43,
    regionalRank: 10,
  },
  {
    name: '한서대학교',
    faculty: 221,
    papers: 49.45,
    perCapita: 0.2238,
    nationalRank: 48,
    regionalRank: 11,
  },
  {
    name: '호서대학교',
    faculty: 406,
    papers: 52.65,
    perCapita: 0.1297,
    nationalRank: 71,
    regionalRank: 17,
  },
  {
    name: '나사렛대학교',
    faculty: 147,
    papers: 3.98,
    perCapita: 0.027,
    nationalRank: 117,
    regionalRank: 27,
  },
]

const CAPTION = '2026년 천안·아산 5개 대학 비교 (충청권)'

export const 기본: Story = {
  args: {
    rows: 천안아산5개교,
    caption: CAPTION,
    highlightName: '호서대학교',
  },
}

/** 대상 대학이 그 해 비교군에 없으면 아무 행도 강조되지 않는다. */
export const 강조_없음: Story = {
  args: {
    rows: 천안아산5개교,
    caption: '2026년 천안·아산 5개 대학 비교 (대상 대학 미지정)',
  },
}

/**
 * 결측(`—`)과 실적 0(`0.0편`)을 나란히 두고 눈으로 구분한다. 셋 다 실제 값이다.
 *
 * - 포항공과대학교: 충청권 밖이라 서버가 권역순위를 못 채운다 → `—`
 * - 금강대학교: 2026년 논문 실적이 진짜로 0 이다 → `0.0편`, 순위는 둘 다 있다
 */
export const 결측_순위: Story = {
  args: {
    caption: '순위 결측과 실적 0 의 구분',
    highlightName: '호서대학교',
    rows: [
      {
        name: '포항공과대학교',
        faculty: 294,
        papers: 357.17,
        perCapita: 1.2149,
        nationalRank: 1,
        regionalRank: null,
      },
      천안아산5개교[3],
      {
        name: '금강대학교',
        faculty: 9,
        papers: 0,
        perCapita: 0,
        nationalRank: 126,
        regionalRank: 29,
      },
    ],
  },
}

export const 데이터_없음: Story = {
  args: { rows: [], caption: '2026년 비교군 (데이터 없음)' },
}

export const 로딩중: Story = {
  args: { rows: 천안아산5개교, caption: CAPTION, loading: true },
}

/**
 * 자릿수 스트레스. 교원 네 자리(성균관대)와 한 자리(금강대), 논문 네 자리와
 * 0 을 한 표에 넣어 소수점이 세로로 맞는지 본다. 전부 실제 2026년 값이다.
 *
 * 마지막 행의 이름만 지어냈다 — 실제 최장 학교명이 "한양대학교(ERICA)" 12자라
 * 줄바꿈 한계를 못 건드린다. 실적 숫자는 호서대 실제 값을 그대로 쓴다.
 */
export const 극단값: Story = {
  args: {
    caption: '자릿수 스트레스 테스트',
    highlightName: '한국과학기술원부설한국정보통신대학교세종캠퍼스제2공학관',
    rows: [
      {
        name: '성균관대학교',
        faculty: 1554,
        papers: 1636.36,
        perCapita: 1.053,
        nationalRank: 3,
        regionalRank: null,
      },
      천안아산5개교[0],
      {
        name: '금강대학교',
        faculty: 9,
        papers: 0,
        perCapita: 0,
        nationalRank: 126,
        regionalRank: 29,
      },
      {
        ...천안아산5개교[3],
        name: '한국과학기술원부설한국정보통신대학교세종캠퍼스제2공학관',
      },
    ],
  },
}

/**
 * 390px 화면. 표를 줄여서 우겨넣지 않고 가로로 스크롤시킨다 —
 * 열을 좁히면 숫자가 줄바꿈되면서 오히려 못 읽는다.
 */
export const 모바일_390px: Story = {
  args: {
    rows: 천안아산5개교,
    caption: CAPTION,
    highlightName: '호서대학교',
  },
  render: (args) => (
    <div style={{ width: 390, border: '1px dashed currentColor' }}>
      <CompareTable {...args} />
    </div>
  ),
}
