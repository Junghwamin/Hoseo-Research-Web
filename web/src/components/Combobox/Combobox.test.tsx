import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { Combobox } from './Combobox'
import { filterOptions } from './filter'

/**
 * 사용자가 콕 집어 말한 기능이다 — "대학교 선택하는 것".
 *
 * 원본 Streamlit 판은 `selectbox` 로 전국 134개교를 가나다순 목록에서 고르게
 * 했고 타이핑 검색도 됐다. **없는 이름을 넣는 것이 구조적으로 불가능**했다.
 * 이관 과정에서 자유 텍스트 입력이 되어, 오타 한 번이면 404 였다.
 *
 * 그래서 이 컴포넌트의 계약은 "고르기 편하다" 가 아니라
 * **"목록에 없는 값이 확정되지 않는다"** 다.
 */

const 대학 = [
  '가야대학교',
  '가천대학교',
  '호서대학교',
  '한국기술교육대학교',
  '순천향대학교',
  '단국대학교',
]

function setup(props: Partial<React.ComponentProps<typeof Combobox>> = {}) {
  const onChange = vi.fn()
  render(
    <Combobox
      label="대상 대학"
      options={대학}
      value={null}
      onChange={onChange}
      placeholder="대학 이름을 입력하거나 목록에서 고른다"
      {...props}
    />,
  )
  return { onChange, user: userEvent.setup() }
}

describe('Combobox — 목록에서 고르기', () => {
  it('타이핑하면 일치하는 것만 남는다', async () => {
    const { user } = setup()
    const input = screen.getByRole('combobox', { name: '대상 대학' })

    await user.click(input)
    await user.type(input, '대학교')
    expect(screen.getAllByRole('option').length).toBe(대학.length)

    await user.clear(input)
    await user.type(input, '호서')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('호서대학교')
  })

  it('고르면 값이 올라가고 목록이 닫힌다', async () => {
    const { user, onChange } = setup()
    const input = screen.getByRole('combobox', { name: '대상 대학' })

    await user.click(input)
    await user.click(screen.getByRole('option', { name: '순천향대학교' }))

    expect(onChange).toHaveBeenCalledWith('순천향대학교')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('키보드만으로 고를 수 있다', async () => {
    const { user, onChange } = setup()
    const input = screen.getByRole('combobox', { name: '대상 대학' })

    await user.click(input)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith(대학[1])
  })

  it('Escape 를 누르면 닫히고 확정 전 입력은 되돌아간다', async () => {
    const { user, onChange } = setup({ value: '호서대학교' })
    const input = screen.getByRole('combobox', { name: '대상 대학' })

    await user.click(input)
    await user.clear(input)
    await user.type(input, '순천')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).toBeNull()
    // 취소했으므로 원래 값이 남아야 한다 — 반쯤 친 글자가 남으면
    // 사용자는 "순천" 이 선택된 줄 안다.
    expect(input).toHaveValue('호서대학교')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('목록에 없는 이름은 확정되지 않는다', async () => {
    // **이 테스트가 이 컴포넌트의 존재 이유다.**
    const { user, onChange } = setup()
    const input = screen.getByRole('combobox', { name: '대상 대학' })

    await user.click(input)
    await user.type(input, '없는대학교')
    // 열려 있는 동안에는 왜 못 고르는지 말해 준다
    expect(screen.getByRole('status')).toHaveTextContent('일치하는 대학이 없다')

    await user.keyboard('{Enter}')
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('포커스를 잃으면 확정되지 않은 입력을 버린다', async () => {
    const { user } = setup({ value: '호서대학교' })
    const input = screen.getByRole('combobox', { name: '대상 대학' })

    await user.click(input)
    await user.clear(input)
    await user.type(input, '가천')
    await user.tab()

    expect(input).toHaveValue('호서대학교')
  })
})

describe('Combobox — 경계', () => {
  it('선택지가 비어도 터지지 않는다', () => {
    setup({ options: [] })
    expect(screen.getByRole('combobox', { name: '대상 대학' })).toBeDisabled()
  })

  it('긴 한글 이름도 잘리지 않고 전부 옵션에 들어간다', async () => {
    const { user } = setup({ options: ['한국교원대학교부설고등학교부설연구원대학교'] })
    await user.click(screen.getByRole('combobox', { name: '대상 대학' }))
    expect(screen.getByRole('option')).toHaveTextContent(
      '한국교원대학교부설고등학교부설연구원대학교',
    )
  })

  it('아무것도 치기 전에 "없다" 고 하지 않는다', async () => {
    // 닫힌 상태의 빈 후보 목록을 그대로 읽으면 **아무것도 치기 전에**
    // "일치하는 대학이 없다" 가 뜬다. 쓸 수 있는 화면이 못 쓰는 화면처럼 보인다.
    setup()
    expect(screen.getByRole('status')).toHaveTextContent(`${대학.length}개교에서 고른다`)
    expect(screen.getByRole('status')).not.toHaveTextContent('없다.')
  })

  it('몇 개 중 몇 개가 보이는지 알려준다', async () => {
    const { user } = setup()
    const input = screen.getByRole('combobox', { name: '대상 대학' })
    await user.click(input)
    await user.type(input, '대')
    // 134개 중 어디쯤인지 모르면 더 칠지 스크롤할지 판단할 수 없다
    expect(screen.getByRole('status')).toHaveTextContent(`${대학.length}개`)
  })
})

describe('Combobox — 접근성', () => {
  it('닫힌 상태에 axe 위반이 없다', async () => {
    const { container } = render(
      <Combobox label="대상 대학" options={대학} value="호서대학교" onChange={() => {}} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('열린 상태에서 활성 옵션을 aria-activedescendant 로 가리킨다', async () => {
    const { user } = setup()
    const input = screen.getByRole('combobox', { name: '대상 대학' })

    await user.click(input)
    await user.keyboard('{ArrowDown}')

    const active = input.getAttribute('aria-activedescendant')
    expect(active).toBeTruthy()
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getByRole('option', { selected: true })).toHaveAttribute(
      'id',
      active!,
    )
  })

  it('열림 여부를 aria-expanded 로 알린다', async () => {
    const { user } = setup()
    const input = screen.getByRole('combobox', { name: '대상 대학' })

    expect(input).toHaveAttribute('aria-expanded', 'false')
    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('filterOptions', () => {
  it('부분 일치로 거른다', () => {
    expect(filterOptions(대학, '천')).toEqual(['가천대학교', '순천향대학교'])
  })

  it('빈 질의는 전부 돌려준다', () => {
    expect(filterOptions(대학, '')).toEqual(대학)
    expect(filterOptions(대학, '   ')).toEqual(대학)
  })

  it('앞뒤 공백을 무시한다', () => {
    // 붙여넣기하면 공백이 딸려 온다. 그것 때문에 "없음" 이 뜨면 황당하다.
    expect(filterOptions(대학, '  호서  ')).toEqual(['호서대학교'])
  })

  it('영문은 대소문자를 가리지 않는다', () => {
    expect(filterOptions(['KAIST', 'POSTECH'], 'kaist')).toEqual(['KAIST'])
  })

  it('정확히 일치하는 것을 맨 앞에 둔다', () => {
    // '단국대학교' 를 다 치고 Enter 를 눌렀는데 다른 게 잡히면 안 된다
    const names = ['단국대학교글로컬', '단국대학교']
    expect(filterOptions(names, '단국대학교')[0]).toBe('단국대학교')
  })
})
