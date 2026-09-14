import type { Preview, Decorator } from '@storybook/react-vite'
import { useEffect } from 'react'

import '../src/design/tokens.css'

/**
 * 루프 4단계(시각 확인)는 **라이트/다크 × 모바일/데스크톱 4조합**을 본다.
 * 테마는 `<html data-theme>` 하나로 갈린다(tokens.css) — 스토리에서도
 * 앱과 똑같은 경로를 쓴다.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as 'light' | 'dark'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.style.background = 'var(--surface-base)'
    document.body.style.color = 'var(--text-primary)'
  }, [theme])

  return (
    <div style={{ padding: 'var(--spacing-5)' }}>
      <Story />
    </div>
  )
}

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: '테마',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: '라이트' },
          { value: 'dark', title: '다크' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    viewport: {
      options: {
        mobile: { name: '모바일', styles: { width: '390px', height: '844px' } },
        desktop: { name: '데스크톱', styles: { width: '1440px', height: '900px' } },
      },
    },
    a11y: {
      // 루프 5단계: 위반이 있으면 스토리를 실패로 본다
      test: 'error',
    },
  },
}

export default preview
