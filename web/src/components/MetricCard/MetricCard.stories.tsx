import type { Meta, StoryObj } from '@storybook/react-vite'

import { MetricCard } from './MetricCard'

const meta = {
  title: '지표/MetricCard',
  component: MetricCard,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof MetricCard>

export default meta
type Story = StoryObj<typeof meta>

export const 개선: Story = {
  args: {
    label: '전국순위',
    value: '71위',
    caption: '2026년 기준 · 등재 사립 133개교',
    delta: {
      label: '+6계단',
      direction: 'up',
      srLabel: '전국순위 6계단 상승',
    },
  },
}

export const 악화: Story = {
  args: {
    label: '1인당논문수',
    value: '0.1182편',
    caption: '2025년 기준',
    delta: {
      label: '-0.0115편',
      direction: 'down',
      srLabel: '1인당논문수 0.0115편 감소',
    },
  },
}

export const 변동없음: Story = {
  args: {
    label: '권역순위',
    value: '9위',
    caption: '충청권',
    delta: { label: '변동 없음', direction: 'flat', srLabel: '권역순위 변동 없음' },
  },
}

export const 증감없음: Story = {
  args: { label: '전임교원수', value: '406명', caption: '2026년 기준' },
}

/** 결측과 0 은 다르다 — 나란히 두고 눈으로 확인한다. */
export const 값없음과_영: Story = {
  args: { label: '권역순위', value: null },
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
      <MetricCard {...args} caption="데이터 없음" />
      <MetricCard label="논문수" value="0편" caption="실적 0" />
    </div>
  ),
}

export const 로딩중: Story = {
  args: { label: '전국순위', value: '71위', loading: true },
}

/** 한글 대학명은 길다. 레이아웃이 버티는지 본다. */
export const 긴라벨: Story = {
  args: {
    label: '한국과학기술원부설한국정보통신대학교세종캠퍼스',
    value: '1위',
    caption: '긴 이름 줄바꿈 확인',
  },
}
