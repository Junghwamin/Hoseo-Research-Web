import { useRef, useState } from 'react'

import { api, ApiError, type DatasetPreviewResponse, type PreprocessResponse } from '../../api/client'
import { addOverlayYear, clearOverlay, removeOverlayYear, useOverlay } from '../../api/overlay'
import { Button } from '../../design/ui'

/**
 * 배포 종류. `App` 이 서버의 `canPersist` 로 정해 넘긴다.
 *
 * - `persist`: 서버 디스크에 쓴다(설치본·로컬). `Raw data/` 전체를 다시 계산해 `output/` 을
 *   갈아끼운다.
 * - `browser`: 서버에 쓸 곳이 없다(공개 사이트). 한 해씩 계산한 결과를 **이 브라우저에만**
 *   저장해 분석에 더한다.
 */
export type DataUpdateMode = 'persist' | 'browser'

export interface DataUpdatePanelProps {
  readonly mode: DataUpdateMode
  /**
   * 데이터가 바뀌었을 때 부른다 — 영구 갱신이 끝났을 때, 그리고 브라우저 데이터를
   * 더하거나 뺐을 때. 화면이 들고 있던 옛 숫자를 버리는 자리다.
   */
  readonly onUpdated: (result?: PreprocessResponse | DatasetPreviewResponse) => void
  readonly onClose: () => void
}

/** 파일명에서 연도를 읽는 규칙. 서버(`YEAR_PATTERN`)와 같은 것을 본다. */
const YEAR_IN_NAME = /(\d{4})(?:년|_)/

function fileYear(name: string): number | null {
  const match = YEAR_IN_NAME.exec(name.normalize('NFC'))
  return match ? Number(match[1]) : null
}

/**
 * 공시 xlsx 로 데이터를 갱신하거나(persist) 분석에 더한다(browser).
 *
 * 원본 Streamlit 판의 「새 Raw Excel 파일 업로드」가 하던 일이다. 이관에서
 * 엔드포인트째 빠져, 새 연도 공시가 나와도 화면에서 넣을 방법이 없었다.
 *
 * **분석 화면 안에 두지 않는다.** 대부분의 사용은 데이터를 바꾸지 않고, 1단계에
 * 업로더를 얹으면 매번 지나쳐야 하는 관문이 된다. 상단바에서 열리는 별도 패널이다.
 *
 * 고르자마자 보내지 않는다. **무엇이 올라가는지 보여주고 누르게 한다.**
 */
export function DataUpdatePanel({ mode, onUpdated, onClose }: DataUpdatePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PreprocessResponse | null>(null)
  const [added, setAdded] = useState<DatasetPreviewResponse[]>([])
  const overlay = useOverlay()

  // 서버도 막지만, 올린 뒤에 듣는 것보다 고를 때 아는 편이 낫다.
  //
  // **NFC 정규화를 빼면 안 된다.** macOS 는 파일명을 NFD 로 보내서 '년' 이
  // 자모로 분해된다. 서버(`safe_name`)와 코어(`scan_raw_files`)는 정규화하는데
  // 화면만 안 하면, 서버가 받아 줄 파일을 화면이 "연도가 없다" 며 막는다.
  const rejected = picked.filter((f) => {
    const name = f.name.normalize('NFC')
    return !name.toLowerCase().endsWith('.xlsx') || fileYear(name) === null
  })
  const canSend = picked.length > 0 && rejected.length === 0 && !busy

  function choose(files: FileList | null) {
    setPicked(files ? [...files] : [])
    setError(null)
    setResult(null)
    setAdded([])
  }

  function resetInput() {
    setPicked([])
    if (inputRef.current) inputRef.current.value = ''
  }

  async function sendToServer() {
    setBusy(true)
    setError(null)
    try {
      const next = await api.preprocess(picked)
      setResult(next)
      resetInput()
      onUpdated(next)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * 파일마다 미리보기를 받아 그 해를 더한다. **한 번에 하나씩** — 서버리스 요청 본문
   * 상한이 파일 한두 개 크기라서다. 하나가 실패하면 거기서 멈추고 고른 파일은 남긴다.
   */
  async function addToBrowser() {
    setBusy(true)
    setError(null)
    const done: DatasetPreviewResponse[] = []
    try {
      for (const file of picked) {
        const year = fileYear(file.name)
        setProgress(`${year}년 계산 중…`)
        const preview = await api.datasetPreview(file)
        addOverlayYear(preview, new Date().toISOString())
        done.push(preview)
        setAdded([...done])
        onUpdated(preview)
      }
      resetInput()
    } catch (e) {
      const reason = e instanceof ApiError ? e.detail : e instanceof Error ? e.message : String(e)
      const failedAt = picked[done.length]?.name ?? ''
      setError(
        `${failedAt} 처리에 실패했습니다. ${reason} 파일이 공시 xlsx 가 맞는지 확인하고 다시 올리세요.`,
      )
    } finally {
      setProgress(null)
      setBusy(false)
    }
  }

  function remove(year: number) {
    removeOverlayYear(year)
    setAdded((list) => list.filter((p) => p.year !== year))
    onUpdated()
  }

  function removeAll() {
    clearOverlay()
    setAdded([])
    onUpdated()
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      {mode === 'persist' ? (
        <p className="m-0 text-body text-[var(--text-secondary)]">
          대학알리미 「전임교원의 연구 실적」 공시 xlsx 를 올리면 전체 데이터를 다시
          만듭니다. 파일명에 <code>2026년</code> 처럼 연도가 들어 있어야 합니다.
        </p>
      ) : (
        <p className="m-0 text-body text-[var(--text-secondary)]">
          대학알리미 「전임교원의 연구 실적」 공시 xlsx 를 올리면 그 해의 지표와 순위를 계산해
          분석에 더합니다. 이 브라우저에만 저장되고 서버에는 남지 않습니다. 파일명에{' '}
          <code>2027년</code> 처럼 연도가 들어 있어야 합니다.
        </p>
      )}

      {/* 드롭존. 입력은 sr-only 로 살려 둔다 — display:none 이면 키보드·보조
          기술·테스트가 전부 닿지 못한다. 라벨이 눌리는 면이고 드롭도 받는다. */}
      <label
        className="
          flex cursor-pointer flex-col items-center justify-center gap-[var(--spacing-1)]
          border border-dashed border-[var(--border-strong)]
          bg-[var(--surface-sunken)] px-[var(--spacing-5)] py-[var(--spacing-6)]
          text-center text-body text-[var(--text-secondary)]
          has-[:focus-visible]:outline has-[:focus-visible]:outline-2
          has-[:focus-visible]:outline-[var(--focus-ring)]
          has-[:disabled]:cursor-not-allowed
        "
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (!busy) choose(e.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx"
          data-testid="raw-file-input"
          aria-label="Raw Excel 파일"
          disabled={busy}
          onChange={(e) => choose(e.target.files)}
          className="sr-only"
        />
        <span className="font-semibold text-[var(--text-primary)]">
          xlsx 파일을 끌어다 놓거나 눌러서 고르세요
        </span>
        <span className="text-meta text-[var(--text-muted)]">여러 해를 한 번에 올려도 됩니다</span>
      </label>

      {picked.length > 0 && (
        <ul
          data-testid="picked-files"
          className="m-0 flex list-none flex-col gap-[var(--spacing-1)] p-0 text-body"
        >
          {picked.map((f) => {
            const bad = rejected.includes(f)
            return (
              <li
                key={f.name}
                className={bad ? 'text-[var(--color-down)]' : 'text-[var(--text-secondary)]'}
              >
                {f.name}
                {bad && ' · xlsx 가 아니거나 파일명에 연도가 없습니다'}
              </li>
            )
          })}
        </ul>
      )}

      {mode === 'persist' && (
        // 되돌릴 수 없는 동작은 아니지만(직전 output 은 백업된다), 무엇이
        // 일어나는지 누르기 전에 알려 준다.
        <p className="m-0 text-meta text-[var(--text-muted)]">
          <code>Raw data/</code> 폴더 전체를 다시 계산합니다. 올린 연도만이 아니라 모든 연도의
          순위가 다시 매겨집니다. 직전 결과는 자동으로 백업됩니다.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-[var(--spacing-3)]">
        {mode === 'persist' ? (
          <Button
            variant="primary"
            data-testid="preprocess-button"
            disabled={!canSend}
            busy={busy}
            busyLabel="전처리 중…"
            onClick={sendToServer}
          >
            데이터 다시 만들기
          </Button>
        ) : (
          <Button
            variant="primary"
            data-testid="overlay-add-button"
            disabled={!canSend}
            busy={busy}
            busyLabel="계산 중…"
            onClick={addToBrowser}
          >
            분석에 추가
          </Button>
        )}
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          닫기
        </Button>
        {progress && (
          <span data-testid="overlay-progress" role="status" className="text-body text-[var(--text-secondary)]">
            {progress}
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          data-testid={mode === 'persist' ? 'preprocess-error' : 'overlay-error'}
          className="m-0 text-body text-[var(--color-down)]"
        >
          {error}
        </p>
      )}

      {result && (
        <div
          role="status"
          data-testid="preprocess-result"
          className="
            flex flex-col gap-[var(--spacing-1)]
            bg-[var(--accent-soft)] p-[var(--spacing-4)] text-body text-[var(--text-primary)]
          "
        >
          {/* "완료됐습니다" 만 띄우면 올린 파일이 정말 반영됐는지 알 수 없다.
              바뀐 것을 숫자로 말한다. */}
          <strong>
            {result.years.length}개년 · {result.universities}개교로 다시 만들었습니다
          </strong>
          <span className="text-[var(--text-secondary)]">
            연도 {result.years[0]}–{result.years[result.years.length - 1]} · 전국{' '}
            {result.nationalRows.toLocaleString('ko-KR')}행 · 권역{' '}
            {result.regionalRows.toLocaleString('ko-KR')}행
          </span>
          {result.backupPath && (
            <span className="text-meta text-[var(--text-muted)]">
              직전 결과는 output/{result.backupPath} 에 백업했습니다
            </span>
          )}
        </div>
      )}

      {added.length > 0 && (
        <ul
          role="status"
          data-testid="overlay-result"
          className="
            m-0 flex list-none flex-col gap-[var(--spacing-1)]
            bg-[var(--accent-soft)] p-[var(--spacing-4)] text-body text-[var(--text-primary)]
          "
        >
          {added.map((p) => (
            <li key={p.year}>
              <strong>
                {p.year}년 {p.universities}개교 추가됨
              </strong>
            </li>
          ))}
        </ul>
      )}

      {mode === 'browser' && (
        <section
          aria-label="추가된 데이터"
          className="flex flex-col gap-[var(--spacing-2)] border-t border-[var(--border-subtle)] pt-[var(--spacing-4)]"
        >
          <div className="flex items-center justify-between gap-[var(--spacing-3)]">
            <h3 className="eyebrow m-0 text-[var(--text-secondary)]">추가된 데이터</h3>
            {overlay && overlay.items.length > 0 && (
              <Button size="sm" variant="ghost" data-testid="overlay-clear" onClick={removeAll} disabled={busy}>
                모두 지우기
              </Button>
            )}
          </div>
          {overlay && overlay.items.length > 0 ? (
            <ul data-testid="overlay-items" className="m-0 flex list-none flex-col p-0 text-body">
              {overlay.items.map((item) => (
                <li
                  key={item.year}
                  className="
                    flex items-center justify-between gap-[var(--spacing-3)]
                    border-b border-[var(--border-subtle)] py-[var(--spacing-2)] last:border-b-0
                  "
                >
                  <span className="min-w-0 truncate text-[var(--text-primary)]">
                    <span className="tabular font-[family-name:var(--font-numeric)]">{item.year}</span>년 ·{' '}
                    {item.universities}개교 ·{' '}
                    <span className="text-[var(--text-muted)]">{item.sourceFile}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`overlay-remove-${item.year}`}
                    disabled={busy}
                    onClick={() => remove(item.year)}
                  >
                    제거
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-body text-[var(--text-muted)]">추가된 데이터가 없습니다.</p>
          )}
        </section>
      )}
    </div>
  )
}
