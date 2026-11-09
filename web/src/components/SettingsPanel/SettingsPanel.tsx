import { useEffect, useState } from 'react'

import { api, ApiError, type SettingsResponse } from '../../api/client'
import {
  clearClientKey,
  maskKey,
  setClientKey,
  useClientKey,
  validateKeyFormat,
} from '../../api/clientKey'
import { Button, Field, CONTROL_CLASS } from '../../design/ui'

export interface SettingsPanelProps {
  readonly onClose: () => void
  /**
   * 키 상태가 바뀌면 부른다 — 서버에 저장했을 때도, 브라우저 키를 저장·삭제했을 때도.
   * 4단계처럼 키 유무로 화면이 갈리는 곳이 다시 계산하는 자리다.
   */
  readonly onSaved?: (next: SettingsResponse) => void
  /** 다른 화면 안에 끼워 넣은 경우. 닫을 모달이 없으므로 「닫기」를 그리지 않는다. */
  readonly embedded?: boolean
}

/** 배포 종류. `canPersist` 하나가 정한다 — 서버 키 유무는 모드를 바꾸지 않는다. */
export type SettingsMode = 'persist' | 'browser'

/**
 * OpenAI 키 설정.
 *
 * 두 모드가 있고, 서버의 `canPersist` 가 고른다.
 *
 * - **persist**(설치본·로컬): 키를 서버의 `.env` 에 저장한다. 키 값은 화면에 오지
 *   않는다 — 서버는 설정 여부·출처·마스킹 힌트만 내려준다(V16 의 해법).
 * - **browser**(공개 사이트): 서버에 저장할 디스크가 없다. 키는 **이 브라우저에만**
 *   저장되고 서술을 만들 때만 헤더로 OpenAI 까지 간다. 서버 키가 있어도 이 폼을
 *   보인다 — 방문자는 자기 키를 쓸 수 있어야 하고, 헤더가 서버 키보다 먼저다.
 *
 * 입력한 키는 어느 모드에서도 React 상태에 오래 두지 않는다. 저장하면 즉시 지운다.
 */
export function SettingsPanel({ onClose, onSaved, embedded = false }: SettingsPanelProps) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const clientKey = useClientKey()

  useEffect(() => {
    let alive = true
    api
      .settings()
      .then((s) => alive && setSettings(s))
      .catch((e) => alive && setError(e instanceof ApiError ? e.detail : String(e)))
    return () => {
      alive = false
    }
  }, [])

  const mode: SettingsMode = settings?.canPersist === false ? 'browser' : 'persist'

  async function saveToServer() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const next = await api.saveApiKey(draft)
      setSettings(next)
      // 저장했으면 즉시 지운다. 화면에도 메모리에도 남길 이유가 없다.
      setDraft('')
      setSaved(true)
      onSaved?.(next)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setSaving(false)
    }
  }

  function saveToBrowser() {
    const problem = validateKeyFormat(draft)
    if (problem) {
      setError(problem)
      return
    }
    setClientKey(draft)
    setDraft('')
    setError(null)
    setSaved(true)
    if (settings) onSaved?.(settings)
  }

  function clearBrowserKey() {
    clearClientKey()
    setSaved(false)
    setError(null)
    if (settings) onSaved?.(settings)
  }

  if (!settings) {
    return (
      <div className="flex flex-col gap-[var(--spacing-4)]">
        {error ? (
          <p role="alert" className="m-0 text-body text-[var(--color-down)]">
            설정을 불러오지 못했습니다. {error}
          </p>
        ) : (
          <p className="m-0 text-body text-[var(--text-muted)]">설정을 불러오는 중…</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-5)]">
      {mode === 'persist' ? (
        <dl
          data-testid="settings-status"
          data-mode="persist"
          className="
            m-0 grid grid-cols-[auto_1fr] gap-x-[var(--spacing-4)]
            gap-y-[var(--spacing-2)] text-body
          "
        >
          <dt className="text-[var(--text-secondary)]">OpenAI API 키</dt>
          <dd className="m-0 text-[var(--text-primary)]">
            {settings.apiKeyConfigured ? (
              <>
                설정됨{' '}
                <span className="tabular font-[family-name:var(--font-mono)] text-[var(--text-muted)]">
                  ({settings.apiKeyHint})
                </span>
              </>
            ) : (
              <span className="text-[var(--color-down)]">설정되지 않음</span>
            )}
          </dd>

          {settings.apiKeySource && (
            <>
              <dt className="text-[var(--text-secondary)]">출처</dt>
              <dd className="m-0 text-[var(--text-primary)]">
                {settings.apiKeySource === 'env' ? '환경변수' : '.env 파일'}
              </dd>
            </>
          )}
        </dl>
      ) : (
        <dl
          data-testid="settings-status"
          data-mode="browser"
          className="
            m-0 grid grid-cols-[auto_1fr] gap-x-[var(--spacing-4)]
            gap-y-[var(--spacing-2)] text-body
          "
        >
          <dt className="text-[var(--text-secondary)]">OpenAI API 키</dt>
          <dd className="m-0 text-[var(--text-primary)]">
            <span data-testid="client-key-status" role="status">
              {clientKey ? (
                <>
                  이 브라우저에 저장된 키{' '}
                  <span className="tabular font-[family-name:var(--font-mono)] text-[var(--text-muted)]">
                    · {maskKey(clientKey)}
                  </span>
                </>
              ) : (
                '저장된 키가 없습니다'
              )}
            </span>
          </dd>
          {settings.apiKeyConfigured && (
            <>
              <dt className="text-[var(--text-secondary)]">서버</dt>
              <dd className="m-0 text-[var(--text-secondary)]">
                서버에 키가 설정돼 있습니다 · 브라우저 키가 있으면 그것을 먼저 씁니다
              </dd>
            </>
          )}
        </dl>
      )}

      {mode === 'persist' ? (
        <>
          <Field
            label="새 API 키"
            error={error}
            hint="sk- 로 시작하는 키를 넣으세요. 키는 이 PC 의 서버에만 저장되고 브라우저로 다시 내려오지 않습니다."
          >
            {(field) => (
              <input
                {...field}
                data-testid="api-key-input"
                // password 로 둔다. 어깨너머로 보이는 것도 유출이고,
                // 브라우저가 평문으로 자동완성 저장하는 것도 막는다.
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-…"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setSaved(false)
                }}
                className={`${CONTROL_CLASS} font-[family-name:var(--font-mono)]`}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-[var(--spacing-3)]">
            <Button
              variant="primary"
              data-testid="api-key-save"
              disabled={draft.trim().length === 0}
              busy={saving}
              busyLabel="저장 중…"
              onClick={saveToServer}
            >
              저장
            </Button>
            {!embedded && (
              <Button variant="ghost" onClick={onClose}>
                닫기
              </Button>
            )}
            {saved && (
              <span role="status" className="text-body text-[var(--color-up)]">
                저장했습니다. 서버를 다시 켜지 않아도 바로 쓸 수 있습니다.
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-body text-[var(--text-secondary)]">
            키는 이 브라우저에만 저장되고, 서술을 만들 때만 OpenAI 로 전달됩니다. 서버에는 남지
            않습니다. 공용 PC 라면 쓰고 나서 지우세요.
          </p>

          <Field label="OpenAI API 키" error={error} hint="sk- 로 시작하는 키를 붙여 넣으세요.">
            {(field) => (
              <input
                {...field}
                data-testid="client-key-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-…"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setSaved(false)
                  setError(null)
                }}
                className={`${CONTROL_CLASS} font-[family-name:var(--font-mono)]`}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-[var(--spacing-3)]">
            <Button
              variant="primary"
              data-testid="client-key-save"
              disabled={draft.trim().length === 0}
              onClick={saveToBrowser}
            >
              저장
            </Button>
            <Button
              variant="secondary"
              data-testid="client-key-clear"
              disabled={!clientKey}
              onClick={clearBrowserKey}
            >
              지우기
            </Button>
            {!embedded && (
              <Button variant="ghost" onClick={onClose}>
                닫기
              </Button>
            )}
            {saved && (
              <span className="text-body text-[var(--color-up)]">
                이 브라우저에 저장했습니다. 4단계에서 바로 쓸 수 있습니다.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
