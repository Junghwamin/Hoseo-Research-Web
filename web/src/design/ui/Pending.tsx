import { useEffect, useState } from 'react'

import { cn } from '../../lib/cn'

export interface PendingProps {
  /** 이 시간 안에 끝나는 요청에는 아무것도 보이지 않는다. */
  readonly delayMs?: number
  /** 보조 기술용 문구. */
  readonly label?: string
  /** 자리 크기. 기본은 가로 전체·높이 6rem. */
  readonly className?: string
}

/**
 * 늦게 나타나는 로딩 자리.
 *
 * 200ms 안에 끝나는 요청에 스켈레톤이 번쩍이면 화면이 더 느려 보인다. 그래서
 * 지연 뒤에만 그린다. `role="status"` 는 쓰지 않는다 — 콤보박스의 status 가
 * 페이지의 첫 status 로 남아야 하는 e2e 계약이 있고, 로딩 자리는 알림이 아니라
 * 자리다. 테두리·그림자 없이 sunken 면의 직각 블록 하나로 그린다.
 */
export function Pending({ delayMs = 200, label = '불러오는 중', className }: PendingProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  if (!show) return null

  return (
    <div
      aria-busy="true"
      className={cn(
        'min-h-[6rem] w-full animate-pulse rounded-none bg-[var(--surface-sunken)]',
        className,
      )}
    >
      <span className="sr-only">{label}</span>
    </div>
  )
}
