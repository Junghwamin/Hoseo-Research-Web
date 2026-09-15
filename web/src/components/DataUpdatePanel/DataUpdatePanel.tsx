import { useRef, useState } from 'react'

import { api, ApiError, type PreprocessResponse } from '../../api/client'
import { Button } from '../../design/ui'

export interface DataUpdatePanelProps {
  /** 갱신이 끝나면 부른다. 화면이 들고 있던 옛 숫자를 버리는 자리다. */
  readonly onUpdated: (result: PreprocessResponse) => void
  readonly onClose: () => void
}

/** 파일명에서 연도를 읽는 규칙. 서버(`YEAR_PATTERN`)와 같은 것을 본다. */
const YEAR_IN_NAME = /(\d{4})(?:년|_)/

/**
 * Raw Excel 업로드로 데이터를 갱신한다.
 *
 * 원본 Streamlit 판의 「새 Raw Excel 파일 업로드」가 하던 일이다. 이관에서
 * 엔드포인트째 빠져, 새 연도 공시가 나와도 화면에서 넣을 방법이 없었다 —
 * 파일을 손으로 `Raw data/` 에 넣고 CLI 를 돌려야 했다.
 *
 * **분석 화면 안에 두지 않는다.** 대부분의 사용은 데이터를 바꾸지 않고,
 * 1단계에 업로더를 얹으면 매번 지나쳐야 하는 관문이 된다. 상단바에서 열리는
 * 별도 패널로 둔다 — 설정과 같은 취급이다.
 *
 * 고르자마자 보내지 않는다. **무엇이 올라가는지 보여주고 누르게 한다** —
 * 이 동작은 `output/` 을 통째로 다시 만들기 때문에, 실수로 눌리는 일이
 * 없어야 한다.
 */
export function DataUpdatePanel({ onUpdated, onClose }: DataUpdatePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PreprocessResponse | null>(null)

  // 서버도 막지만, 올린 뒤에 듣는 것보다 고를 때 아는 편이 낫다.
  //
  // **NFC 정규화를 빼면 안 된다.** macOS 는 파일명을 NFD 로 보내서 '년' 이
  // 자모로 분해된다. 서버(`safe_name`)와 코어(`scan_raw_files`)는 정규화하는데
  // 화면만 안 하면, 서버가 받아 줄 파일을 화면이 "연도가 없다" 며 막는다.
  const rejected = picked.filter((f) => {
    const name = f.name.normalize('NFC')
    return !name.toLowerCase().endsWith('.xlsx') || !YEAR_IN_NAME.test(name)
  })
  const canSend = picked.length > 0 && rejected.length === 0 && !busy

  function choose(files: FileList | null) {
    setPicked(files ? [...files] : [])
    setError(null)
    setResult(null)
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const next = await api.preprocess(picked)
      setResult(next)
      setPicked([])
      if (inputRef.current) inputRef.current.value = ''
      onUpdated(next)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      <p className="m-0 text-sm text-[var(--text-secondary)]">
        대학알리미 「전임교원의 연구 실적」 공시 xlsx 를 올리면 전체 데이터를
        다시 만든다. 파일명에 <code>2026년</code> 처럼 연도가 들어 있어야 한다.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx"
        data-testid="raw-file-input"
        aria-label="Raw Excel 파일"
        disabled={busy}
        onChange={(e) => choose(e.target.files)}
        className="
          text-sm text-[var(--text-primary)]
          file:mr-[var(--spacing-3)] file:rounded-[var(--radius-full)]
          file:border file:border-[var(--border-strong)] file:bg-[var(--surface-raised)]
          file:px-[var(--spacing-4)] file:py-[var(--spacing-2)]
          file:text-sm file:text-[var(--text-primary)]
        "
      />

      {picked.length > 0 && (
        <ul
          data-testid="picked-files"
          className="m-0 flex list-none flex-col gap-[var(--spacing-1)] p-0 text-sm"
        >
          {picked.map((f) => {
            const bad = rejected.includes(f)
            return (
              <li
                key={f.name}
                className={bad ? 'text-[var(--color-down)]' : 'text-[var(--text-secondary)]'}
              >
                {f.name}
                {bad && ' — xlsx 가 아니거나 파일명에 연도가 없다'}
              </li>
            )
          })}
        </ul>
      )}

      {/* 되돌릴 수 없는 동작은 아니지만(직전 output 은 백업된다), 무엇이
          일어나는지 누르기 전에 알려 준다. */}
      <p className="m-0 text-xs text-[var(--text-muted)]">
        <code>Raw data/</code> 폴더 전체를 다시 계산한다. 올린 연도만이 아니라
        모든 연도의 순위가 다시 매겨진다. 직전 결과는 자동으로 백업된다.
      </p>

      <div className="flex flex-wrap items-center gap-[var(--spacing-3)]">
        <Button
          variant="primary"
          data-testid="preprocess-button"
          disabled={!canSend}
          busy={busy}
          busyLabel="전처리 중…"
          onClick={send}
        >
          데이터 다시 만들기
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          닫기
        </Button>
      </div>

      {error && (
        <p role="alert" data-testid="preprocess-error" className="m-0 text-sm text-[var(--color-down)]">
          {error}
        </p>
      )}

      {result && (
        <div
          role="status"
          data-testid="preprocess-result"
          className="
            flex flex-col gap-[var(--spacing-1)]
            rounded-[var(--radius-md)] bg-[var(--accent-soft)]
            p-[var(--spacing-4)] text-sm text-[var(--text-primary)]
          "
        >
          {/* "완료됐습니다" 만 띄우면 올린 파일이 정말 반영됐는지 알 수 없다.
              바뀐 것을 숫자로 말한다. */}
          <strong>
            {result.years.length}개년 · {result.universities}개교로 다시 만들었다
          </strong>
          <span className="text-[var(--text-secondary)]">
            연도 {result.years[0]}–{result.years[result.years.length - 1]} · 전국{' '}
            {result.nationalRows.toLocaleString('ko-KR')}행 · 권역{' '}
            {result.regionalRows.toLocaleString('ko-KR')}행
          </span>
          {result.backupPath && (
            <span className="text-xs text-[var(--text-muted)]">
              직전 결과는 output/{result.backupPath} 에 백업했다
            </span>
          )}
        </div>
      )}
    </div>
  )
}
