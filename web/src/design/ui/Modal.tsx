import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '../../lib/cn'
import { Button } from './Button'

export interface ModalProps {
  /** dialog 요소의 id. 여는 버튼의 `aria-controls` 가 가리킨다. */
  readonly id: string
  readonly title: string
  readonly open: boolean
  readonly onClose: () => void
  readonly children: ReactNode
  readonly className?: string
}

/**
 * 모달.
 *
 * 네이티브 `<dialog>` 대신 div 인 이유: jsdom 이 `showModal()` 을 구현하지 않아
 * 테스트가 못 돈다. 그래서 `<dialog>` 가 공짜로 주던 것을 직접 한다 —
 *
 * - `role="dialog" aria-modal="true" aria-labelledby`
 * - 열리면 제목으로 포커스, 닫히면 열었던 요소로 복귀
 * - **앱 콘텐츠(`[data-app-root]`)에 `inert`** — `aria-modal` 만으로는 Tab 이
 *   뒤 화면으로 빠져나간다. 포커스 트랩 코드를 쓰는 대신 브라우저에 맡긴다.
 * - Escape·바깥 클릭으로 닫기, 열린 동안 본문 스크롤 잠금
 *
 * `document.body` 에 포털로 그린다. 앱 루트 안에 그리면 자기 자신도 inert 가 된다.
 * 모양은 직각 + 하드 오프셋 그림자(DESIGN.md §6). 닫기는 선이 있는 secondary 다 —
 * ghost 였을 때 머리글에서 글자 두 자로만 보여 찾기 어려웠다.
 */
export function Modal({ id, title, open, onClose, children, className }: ModalProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  // 부모가 매 렌더마다 새 함수를 넘겨도 effect 가 다시 돌지 않게 한다 — 다시
  // 돌면 cleanup 이 포커스를 바깥으로 돌려놓는다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = `${id}-title`

  useEffect(() => {
    if (!open) return

    const opener = document.activeElement as HTMLElement | null
    const appRoot = document.querySelector('[data-app-root]')
    const previousOverflow = document.body.style.overflow

    appRoot?.setAttribute('inert', '')
    document.body.style.overflow = 'hidden'
    headingRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      appRoot?.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="
        fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
        p-[var(--spacing-4)] sm:items-center
      "
    >
      <div
        data-testid="modal-overlay"
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-[var(--surface-scrim)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        id={id}
        className={cn(
          `relative w-full max-w-[36rem] rounded-none border border-[var(--border-strong)]
           bg-[var(--surface-raised)] shadow-[var(--shadow-hard)]`,
          className,
        )}
      >
        <header
          className="
            flex items-center justify-between gap-[var(--spacing-4)]
            border-b border-[var(--border-subtle)]
            px-[var(--spacing-5)] py-[var(--spacing-4)]
          "
        >
          <h2
            ref={headingRef}
            id={titleId}
            tabIndex={-1}
            className="m-0 text-heading font-bold text-[var(--text-primary)] outline-none"
          >
            {title}
          </h2>
          <Button size="sm" variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </header>
        <div className="p-[var(--spacing-5)]">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
