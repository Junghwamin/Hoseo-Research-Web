import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { Modal } from './Modal'

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div data-app-root>
        <button type="button">바깥 버튼</button>
      </div>
      <Modal id="settings-panel" title="설정" open={open} onClose={onClose}>
        <p>내용</p>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('열리면 이름 있는 dialog 이고 제목에 포커스가 간다', () => {
    render(<Harness open onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: '설정' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('id', 'settings-panel')
    expect(screen.getByRole('heading', { name: '설정' })).toHaveFocus()
  })

  it('열려 있는 동안 앱 콘텐츠는 inert 다 — aria-modal 만으로는 Tab 이 밖으로 나간다', () => {
    render(<Harness open onClose={vi.fn()} />)
    expect(document.querySelector('[data-app-root]')).toHaveAttribute('inert')
  })

  it('닫히면 inert 가 풀리고 포커스가 열었던 곳으로 돌아온다', () => {
    const onClose = vi.fn()
    const { rerender } = render(<Harness open={false} onClose={onClose} />)
    screen.getByRole('button', { name: '바깥 버튼' }).focus()

    rerender(<Harness open onClose={onClose} />)
    expect(screen.getByRole('heading', { name: '설정' })).toHaveFocus()

    rerender(<Harness open={false} onClose={onClose} />)
    expect(document.querySelector('[data-app-root]')).not.toHaveAttribute('inert')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: '바깥 버튼' })).toHaveFocus()
  })

  it('Escape 와 바깥 클릭으로 닫힌다', () => {
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('직각에 하드 그림자이고, 닫기는 선이 있는 secondary 버튼이다', () => {
    render(<Harness open onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toMatch(/shadow-\[var\(--shadow-hard\)\]/)
    expect(dialog.className).not.toMatch(/rounded-\[/)
    // ghost 닫기는 모달 머리글에서 글자 하나로 보여 찾기 어려웠다.
    const close = screen.getByRole('button', { name: '닫기' })
    expect(close.className).toMatch(/border-\[var\(--border-strong\)\]/)
    expect(close.className).not.toMatch(/border-transparent/)
  })

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(<Harness open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('axe 위반이 없다', async () => {
    render(<Harness open onClose={vi.fn()} />)
    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations()
  })
})
