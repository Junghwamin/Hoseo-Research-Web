import type { Meta, StoryObj } from '@storybook/react-vite'

import { YearPicker } from './YearPicker'

const meta = {
  title: '입력/YearPicker',
  component: YearPicker,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof YearPicker>

export default meta
type Story = StoryObj<typeof meta>

/** 실데이터의 연도 범위(`output/전국_순위.csv` 는 2016~2026 이다). */
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

export const 전체선택: Story = {
  args: { available: YEARS, value: YEARS, baseYear: 2026, onChange: () => {} },
}

/** 기본값에서 벗어난 상태. 「최근 3년」 버튼이 눌린 것으로 보여야 한다. */
export const 최근3년: Story = {
  args: {
    available: YEARS,
    value: [2024, 2025, 2026],
    baseYear: 2026,
    onChange: () => {},
  },
}

/**
 * 기준 연도가 선택 밖인 상태.
 *
 * 화면이 이 상태를 오래 유지하지는 않는다(1단계가 기준 연도를 옮긴다).
 * 다만 한 프레임이라도 이렇게 보일 수 있으므로, 그때 깨지지 않는지 본다.
 */
export const 기준연도가_빠진_상태: Story = {
  args: {
    available: YEARS,
    value: [2016, 2017, 2018],
    baseYear: 2026,
    onChange: () => {},
  },
}

/** 하나만 고른 상태. 원본도 1개년을 허용했다. */
export const 한_해만: Story = {
  args: { available: YEARS, value: [2026], baseYear: 2026, onChange: () => {} },
}

/** 연도를 아직 못 받은 상태. `/api/data` 응답 전이다. */
export const 불러오는_중: Story = {
  args: { available: [], value: [], baseYear: null, onChange: () => {} },
}
