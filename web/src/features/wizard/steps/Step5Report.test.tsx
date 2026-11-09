import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { INITIAL_STATE } from '../../../store/reducer'
import type { WizardState } from '../../../store/types'
import { makeDataset, makeStats } from './stats.fixture'
import { Step5Report } from './Step5Report'
import type { StepActions } from './types'

/**
 * 5단계는 "내려받기 전 확인" 화면이다(GOV.UK check-answers). 구획마다 그 단계로
 * 돌아가는 「변경」이 있고, 차트는 썸네일이 아니라 다섯 줄 목록이다 —
 * 3단계에서 본 그림을 작게 다시 보여주는 것은 확인이 아니라 장식이다.
 */

function renderStep(overrides: Partial<StepActions> = {}, narratives = INITIAL_STATE.narratives) {
  const stats = makeStats()
  const actions: StepActions = {
    goto: vi.fn(),
    next: vi.fn(),
    reset: vi.fn(),
    setNarrative: vi.fn(),
    loadTarget: vi.fn(),
    ...overrides,
  }
  const state: WizardState = {
    ...INITIAL_STATE,
    step: 5,
    maxStep: 5,
    university: stats.university,
    year: stats.year,
    regionName: stats.regionName,
    stats,
    narratives,
  }
  render(<Step5Report state={state} dataset={makeDataset()} actions={actions} />)
  return actions
}

describe('Step5Report', () => {
  beforeEach(() => {
    // jsdom 의 URL 에는 objectURL 이 없고, 임시 <a> 클릭은 이동을 시도한다.
    // URL 전체를 바꾸면 fetch/Response 가 쓰는 생성자까지 사라지므로 메서드만 붙인다.
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:report'),
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (URL as unknown as Record<string, unknown>).createObjectURL
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL
  })

  it('구획마다 변경 버튼이 해당 단계로 간다', async () => {
    const goto = vi.fn()
    renderStep({ goto })
    await userEvent.click(screen.getByTestId('change-scope'))
    await userEvent.click(screen.getByTestId('change-charts'))
    await userEvent.click(screen.getByTestId('change-narratives'))
    expect(goto.mock.calls.map((c) => c[0])).toEqual([1, 3, 4])
  })

  it('차트는 썸네일이 아니라 다섯 줄 목록이다', () => {
    renderStep()
    expect(within(screen.getByTestId('chart-list')).getAllByRole('listitem')).toHaveLength(5)
    expect(document.querySelector('img')).toBeNull()
  })

  it('서술 유무를 절마다 말한다 — 채운 절은 글자 수, 빈 절은 제목만 들어간다고', () => {
    renderStep({}, { ...INITIAL_STATE.narratives, trend: '열두 글자짜리 서술' })
    const summary = screen.getByTestId('report-summary')
    expect(summary).toHaveTextContent('연도별 추이')
    expect(summary).toHaveTextContent('10자')
    expect(summary).toHaveTextContent('비어 있음')
  })

  it('내려받으면 파일명을 알린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          // 본문은 문자열로 — jsdom 의 Blob 을 Node 의 Response 에 넣으면 생성 단계에서 거부된다.
          new Response('docx-bytes', {
            status: 200,
            headers: {
              'Content-Disposition': "attachment; filename*=UTF-8''%ED%98%B8%EC%84%9C_2026.docx",
            },
          }),
      ),
    )
    renderStep()
    await userEvent.click(screen.getByTestId('download-button'))
    const done = await screen.findByTestId('report-done')
    expect(done).toHaveAttribute('role', 'status')
    expect(done).toHaveTextContent('내려받았습니다')
    expect(done).toHaveTextContent('호서_2026.docx')
  })
})
