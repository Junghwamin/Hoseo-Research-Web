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
 * 처음 연 상태.
 *
 * 결과·오류는 실제 업로드가 있어야 나오므로 스토리로 만들지 않는다 —
 * 그 경로는 `DataUpdatePanel.test.tsx` 가 fetch 를 세워 두고 검사한다.
 */
export const 기본: Story = {
  args: { onUpdated: () => {}, onClose: () => {} },
}
