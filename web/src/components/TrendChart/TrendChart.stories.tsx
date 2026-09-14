import type { Meta, StoryObj } from '@storybook/react-vite'

import { TrendChart } from './TrendChart'

const meta = {
  title: '지표/TrendChart',
  component: TrendChart,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TrendChart>

export default meta
type Story = StoryObj<typeof meta>

/** 실제 호서대 데이터(2016~2026). 눈으로 확인할 때 진짜 모양을 본다. */
const hoseo = [
  0.1272, 0.1622, 0.1085, 0.1493, 0.1341, 0.0928, 0.1109, 0.0834, 0.1109, 0.1182, 0.1297,
].map((value, i) => ({ year: 2016 + i, value }))

const chungcheong = [
  0.1502, 0.1611, 0.1638, 0.1701, 0.1744, 0.1712, 0.178, 0.1821, 0.1887, 0.1943, 0.1975,
].map((value, i) => ({ year: 2016 + i, value }))

export const 기본: Story = {
  args: {
    valueLabel: '1인당 논문 수(편)',
    description: '호서대학교와 충청권 평균의 1인당 논문 수 추이 (2016~2026)',
    precision: 4,
    series: [
      { name: '호서대학교', points: hoseo, emphasis: true },
      { name: '충청권 평균', points: chungcheong },
    ],
  },
}

export const 단일_계열: Story = {
  args: {
    valueLabel: '1인당 논문 수(편)',
    description: '호서대학교 1인당 논문 수 추이',
    precision: 4,
    series: [{ name: '호서대학교', points: hoseo, emphasis: true }],
  },
}

/** 중간 연도가 비면 선이 끊겨야 한다. 0 으로 메우면 실적이 0 이었던 것처럼 보인다. */
export const 결측_구간: Story = {
  args: {
    valueLabel: '1인당 논문 수(편)',
    description: '중간 연도 데이터가 없는 경우',
    precision: 4,
    series: [
      {
        name: '제주국제대학교',
        emphasis: true,
        points: [
          { year: 2023, value: 0.052 },
          { year: 2024, value: 0.061 },
          { year: 2025, value: 0.048 },
          { year: 2026, value: null },
        ],
      },
    ],
  },
}

export const 로딩중: Story = {
  args: {
    valueLabel: '편',
    description: '로딩',
    series: [{ name: '호서대학교', points: hoseo, emphasis: true }],
    loading: true,
  },
}

export const 데이터_없음: Story = {
  args: { valueLabel: '편', description: '빈 상태', series: [] },
}
