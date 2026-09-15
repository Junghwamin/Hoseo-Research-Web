import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { YearPicker } from './YearPicker'
import { lastN, matchingPreset } from './presets'

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

function setup(props: Partial<React.ComponentProps<typeof YearPicker>> = {}) {
  const onChange = vi.fn()
  const result = render(
    <YearPicker
      available={YEARS}
      value={YEARS}
      onChange={onChange}
      baseYear={2026}
      {...props}
    />,
  )
  return { onChange, ...result }
}

describe('YearPicker', () => {
  it('데이터에 있는 연도를 전부 보여준다', () => {
    setup()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(YEARS.length)
    expect(boxes.every((b) => b.getAttribute('aria-checked') === 'true')).toBe(true)
  })

  it('누르면 그 해만 빠진다', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('checkbox', { name: '2016년' }))
    expect(onChange).toHaveBeenCalledWith(YEARS.filter((y) => y !== 2016))
  })

  it('다시 누르면 오름차순 자리로 돌아온다', async () => {
    // 정렬을 안 하면 [2025, 2026, 2016] 같은 배열이 그대로 서버로 가고,
    // 차트 캐시 키가 순서에 따라 갈라진다.
    const { onChange } = setup({ value: [2025, 2026] })
    await userEvent.click(screen.getByRole('checkbox', { name: '2016년' }))
    expect(onChange).toHaveBeenCalledWith([2016, 2025, 2026])
  })

  it('기준 연도를 낭독기에도 알린다', () => {
    // 시각 표시(●)만 두면 화면 낭독기 사용자는 어느 해가 기준인지 모른다.
    setup({ baseYear: 2024 })
    expect(screen.getByRole('checkbox', { name: '2024년 (기준 연도)' })).toBeTruthy()
  })

  it('최근 3년 프리셋이 뒤에서 세 개를 고른다', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '최근 3년' }))
    expect(onChange).toHaveBeenCalledWith([2024, 2025, 2026])
  })

  it('지금 선택과 같은 프리셋만 눌린 것으로 보인다', () => {
    // "마지막에 누른 버튼" 을 기억하면, 누른 뒤 체크 하나를 바꿔도 여전히
    // 그 프리셋인 것처럼 보인다 — 화면이 거짓말을 하게 된다.
    setup({ value: [2024, 2025, 2026] })
    const recent3 = screen.getByRole('button', { name: '최근 3년' })
    const all = screen.getByRole('button', { name: '전체' })
    expect(recent3.className).not.toEqual(all.className)
  })

  it('연도 목록이 비어 있어도 터지지 않는다', () => {
    setup({ available: [], value: [] })
    expect(screen.getByText('연도를 불러오는 중…')).toBeTruthy()
  })

  it('접근성 위반이 없다', async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('presets', () => {
  it('가진 것보다 긴 N 을 요구해도 가진 만큼만 준다', () => {
    expect(lastN([2025, 2026], 5)).toEqual([2025, 2026])
  })

  it('0 이하는 빈 배열이다', () => {
    expect(lastN(YEARS, 0)).toEqual([])
    expect(lastN(YEARS, -1)).toEqual([])
  })

  it('정렬되지 않은 입력도 뒤에서 센다', () => {
    expect(lastN([2026, 2016, 2021], 2)).toEqual([2021, 2026])
  })

  it('일치하는 프리셋이 없으면 null', () => {
    expect(matchingPreset(YEARS, [2016, 2026])).toBeNull()
  })

  it('전 연도 선택은 「전체」로 알아본다', () => {
    expect(matchingPreset(YEARS, YEARS)).toBe('전체')
  })
})
