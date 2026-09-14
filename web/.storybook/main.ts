import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-a11y', // 루프 5단계: 접근성
    '@storybook/addon-docs',
  ],
  framework: '@storybook/react-vite',
}

export default config
