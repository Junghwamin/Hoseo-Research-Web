import type { Meta, StoryObj } from '@storybook/react-vite'

import { DataUpdatePanel } from './DataUpdatePanel'

const meta = {
  title: '입력/DataUpdatePanel',
  component: DataUpdatePanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DataUpdatePanel>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 서버 갱신 모드(설치본·로컬). `Raw data/` 전체를 다시 계산한다.
 *
 * 결과·오류는 실제 업로드가 있어야 나오므로 스토리로 만들지 않는다 —
 * 그 경로는 `DataUpdatePanel.test.tsx` 가 fetch 를 세워 두고 검사한다.
 */
export const 서버_갱신: Story = {
  args: { mode: 'persist', onUpdated: () => {}, onClose: () => {} },
}

/** 공개 사이트 모드. 올린 해를 이 브라우저에만 더한다. */
export const 브라우저에_더하기: Story = {
  args: { mode: 'browser', onUpdated: () => {}, onClose: () => {} },
}
