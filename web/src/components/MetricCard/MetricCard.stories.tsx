import type { Meta, StoryObj } from '@storybook/react-vite'

import { Card } from '../../design/ui'
import { MetricCard } from './MetricCard'

const meta = {
  title: '지표/MetricCard',
  component: MetricCard,
  parameters: { layout: 'centered' },
  // 칸은 스스로 테두리를 갖지 않는다 — 띠(부모 패널)가 선을 긋는다. 단독으로 볼 때만
  // 프레임(1px 선 + 소프트 그림자, 직각)을 준다. 띠를 통째로 보이는 스토리는
  // `parameters.frame: false` 로 이 틀을 벗는다 — 스토리 데코레이터는 메타의 것을
  // 대체하지 않고 안쪽에 겹치기 때문이다.
  decorators: [
    (Story, context) =>
      context.parameters.frame === false ? (
        <Story />
      ) : (
        <div className="w-[16rem] border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
          <Story />
        </div>
      ),
  ],
} satisfies Meta<typeof MetricCard>

export default meta
type Story = StoryObj<typeof meta>

/** 2단계의 "답 하나". 한 띠에 이 크기는 하나다 — Geist Mono 700. */
export const 답: Story = {
  args: {
    label: '전국순위',
    value: '71',
    unit: '위',
    size: 'answer',
    caption: '2026년 공시 · 사립 등재교 기준 · 133개교',
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
    value: '0.1182',
    unit: '편',
    caption: '2025년 공시',
    delta: {
      label: '-3.2%',
      direction: 'down',
      srLabel: '전년 대비 3.2퍼센트 감소',
    },
  },
}

export const 변동없음: Story = {
  args: {
    label: '권역순위',
    value: '9',
    unit: '위',
    caption: '충청권',
    delta: { label: '변동 없음', direction: 'flat', srLabel: '권역순위 변동 없음' },
  },
}

export const 증감없음: Story = {
  args: { label: '전임교원수', value: '1,018', unit: '명', caption: '2026년 공시' },
}

/** 결측과 0 은 다르다 — 나란히 두고 눈으로 확인한다. */
export const 값없음과_영: Story = {
  args: { label: '권역순위', value: null },
  render: (args) => (
    <div className="grid grid-cols-2 [&>*+*]:border-l [&>*+*]:border-[var(--border-subtle)]">
      <MetricCard {...args} caption="데이터 없음" />
      <MetricCard label="논문수" value="0" unit="편" caption="실적 0" />
    </div>
  ),
}

export const 로딩중: Story = {
  args: { label: '전국순위', value: '71', unit: '위', loading: true },
}

/** 한글 대학명은 길다. 레이아웃이 버티는지 본다. */
export const 긴라벨: Story = {
  args: {
    label: '한국과학기술원부설한국정보통신대학교세종캠퍼스',
    value: '1',
    unit: '위',
    caption: '긴 이름 줄바꿈 확인',
  },
}

/**
 * 2단계 KPI 띠 — 실제 조립 모양. 네 칸을 **패널**(위 4px 주홍 띠, `Card variant="panel"`)
 * 하나에 넣고 선으로만 나눈다. 답 하나(전국순위)만 kpi 크기다. 2026년 호서대 실제 값.
 */
export const 띠_패널: Story = {
  args: { label: '전국순위', value: '71', unit: '위', size: 'answer' },
  parameters: { layout: 'padded', frame: false },
  render: () => (
    <Card
      variant="panel"
      ariaLabel="주요 지표"
      bodyClassName="
        grid grid-cols-2 p-0 md:grid-cols-4
        [&>*]:border-[var(--border-subtle)]
        [&>:nth-child(even)]:border-l [&>:nth-child(n+3)]:border-t
        md:[&>*+*]:border-l md:[&>:nth-child(n+3)]:border-t-0
      "
    >
      <MetricCard
        label="전국순위"
        size="answer"
        value="71"
        unit="위"
        caption="2026년 공시 · 사립 등재교 기준"
        delta={{ label: '+6계단', direction: 'up', srLabel: '전국순위 6계단 상승' }}
      />
      <MetricCard
        label="권역순위"
        value="17"
        unit="위"
        caption="충청권"
        delta={{ label: '변동 없음', direction: 'flat', srLabel: '권역순위 변동 없음' }}
      />
      <MetricCard
        label="1인당논문수"
        value="0.1297"
        unit="편"
        caption="2026년 공시"
        delta={{ label: '+9.7%', direction: 'up', srLabel: '전년 대비 9.7퍼센트 증가' }}
      />
      <MetricCard label="전임교원수" value="406" unit="명" caption="2026년 공시" />
    </Card>
  ),
}
