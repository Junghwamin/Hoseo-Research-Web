import type { Meta, StoryObj } from '@storybook/react-vite'

import { YoYPanel } from './YoYPanel'

const meta = {
  title: '지표/YoYPanel',
  component: YoYPanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof YoYPanel>

export default meta
type Story = StoryObj<typeof meta>

/** 실제 2026년 충청권 결과. 눈으로 확인할 때 진짜 숫자를 본다. */
const 호서대 = {
  name: '호서대학교',
  changeRate: 9.7,
  baseValue: 0.1297,
  compareValue: 0.1182,
}

export const 기본: Story = {
  args: {
    baseYear: 2026,
    compareYear: 2025,
    changes: {
      top: [
        { name: '건양대학교', changeRate: 24.1, baseValue: 0.2314, compareValue: 0.1865 },
        { name: '한남대학교', changeRate: 15.6, baseValue: 0.1902, compareValue: 0.1645 },
        { name: '호서대학교', changeRate: 9.7, baseValue: 0.1297, compareValue: 0.1182 },
      ],
      bottom: [
        { name: '꽃동네대학교', changeRate: -18.3, baseValue: 0.0721, compareValue: 0.0882 },
        { name: '중부대학교', changeRate: -9.4, baseValue: 0.1103, compareValue: 0.1217 },
        { name: '극동대학교', changeRate: -3.2, baseValue: 0.0894, compareValue: 0.0924 },
      ],
      target: 호서대,
    },
  },
}

/**
 * V12 가 났던 자리. 이전값이 0 이면 증감률을 낼 수 없어 서버가 null 을 보낸다.
 * "신규" 로 찍혀야 하고, "+0.0%" 가 나오면 결함이 돌아온 것이다.
 * 바로 옆의 `0` 과 나란히 두고 둘이 다르게 보이는지 확인한다.
 */
export const 신규와_변동없음: Story = {
  args: {
    baseYear: 2026,
    compareYear: 2025,
    changes: {
      top: [
        { name: '한국교통대학교', changeRate: null, baseValue: 0.0843, compareValue: 0 },
        { name: '세명대학교', changeRate: null, baseValue: 0.1521, compareValue: 0 },
      ],
      bottom: [
        { name: '청운대학교', changeRate: 0, baseValue: 0.1044, compareValue: 0.1044 },
        { name: '유원대학교', changeRate: -0.4, baseValue: 0.0712, compareValue: 0.0715 },
      ],
      target: 호서대,
    },
  },
}

/**
 * 비교군이 6행 미만이면 상위 3·하위 3 을 뽑을 때 같은 대학이 양쪽에 들어간다.
 * 조용히 그리지 않고 경고를 낸다.
 */
export const 상하위_중복: Story = {
  args: {
    baseYear: 2026,
    compareYear: 2025,
    changes: {
      top: [
        { name: '강릉원주대학교', changeRate: 6.2, baseValue: 0.1421, compareValue: 0.1338 },
        { name: '가톨릭관동대학교', changeRate: -2.8, baseValue: 0.1015, compareValue: 0.1044 },
      ],
      bottom: [
        { name: '가톨릭관동대학교', changeRate: -2.8, baseValue: 0.1015, compareValue: 0.1044 },
        { name: '강릉원주대학교', changeRate: 6.2, baseValue: 0.1421, compareValue: 0.1338 },
      ],
      target: {
        name: '가톨릭관동대학교',
        changeRate: -2.8,
        baseValue: 0.1015,
        compareValue: 0.1044,
      },
    },
  },
}

/** 전년도 데이터가 아예 없는 첫 해. 대상도 비교 대상도 없다. */
export const 전년도_없음: Story = {
  args: {
    baseYear: 2016,
    compareYear: 2015,
    changes: { top: [], bottom: [], target: null },
  },
}

export const 로딩중: Story = {
  args: {
    baseYear: 2026,
    compareYear: 2025,
    changes: { top: [], bottom: [], target: 호서대 },
    loading: true,
  },
}

/**
 * 극단값. 긴 한글 대학명, 세 자리 증감률, 소수 넷째 자리에서야 보이는 미세한
 * 변화가 한 화면에 있을 때 레이아웃과 자릿수가 버티는지 본다.
 */
export const 극단값: Story = {
  args: {
    baseYear: 2026,
    compareYear: 2025,
    changes: {
      top: [
        {
          name: '한국과학기술원부설한국정보통신대학교세종캠퍼스',
          changeRate: 412.5,
          baseValue: 1.2874,
          compareValue: 0.2512,
        },
        { name: '미세증가대학교', changeRate: 0.04, baseValue: 0.1001, compareValue: 0.1 },
      ],
      bottom: [
        { name: '급감대학교', changeRate: -96.8, baseValue: 0.0032, compareValue: 0.1 },
        { name: '미세감소대학교', changeRate: -0.04, baseValue: 0.1, compareValue: 0.1001 },
      ],
      target: {
        name: '한국과학기술원부설한국정보통신대학교세종캠퍼스',
        changeRate: 412.5,
        baseValue: 1.2874,
        compareValue: 0.2512,
      },
    },
  },
}
