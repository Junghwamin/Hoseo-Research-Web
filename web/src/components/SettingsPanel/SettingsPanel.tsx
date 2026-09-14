import { useEffect, useState } from 'react'

import { api, ApiError, type SettingsResponse } from '../../api/client'
import { Button, Field, CONTROL_CLASS } from '../../design/ui'

export interface SettingsPanelProps {
  readonly onClose: () => void
}

/**
 * API 키 설정.
 *
 * Streamlit 판에서 설정 화면은 **어디서도 도달할 수 없는 죽은 라우트**였다
 * (사이드바 모듈 목록에 없었다). 그래서 키가 없을 때 사이드바에 "⚠ 미설정"
 * 만 뜨고, 사용자가 할 수 있는 일이 없었다(V16).
 *
 * 두 가지를 지킨다.
 *
 * 1. **키 값은 화면에 오지 않는다.** 서버는 설정 여부·출처·마스킹 힌트만
 *    내려준다. 키를 되돌려주면 개발자 도구에 그대로 남는다.
 * 2. **입력한 키는 상태로 남기지 않는다.** 저장하면 즉시 지운다 — React
 *    상태에 남겨 두면 다른 컴포넌트가 실수로 읽거나 오류 보고에 실린다.
 */
export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const next = await api.saveApiKey(draft)
      setSettings(next)
      // 저장했으면 즉시 지운다. 화면에도 메모리에도 남길 이유가 없다.
      setDraft('')
      setSaved(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-4)]">
      {settings && (
        <dl
          data-testid="settings-status"
          className="
            m-0 grid grid-cols-[auto_1fr] gap-x-[var(--spacing-4)]
            gap-y-[var(--spacing-2)] text-sm
          "
        >
          <dt className="text-[var(--text-secondary)]">OpenAI API 키</dt>
          <dd className="m-0 text-[var(--text-primary)]">
            {settings.apiKeyConfigured ? (
              <>
                설정됨{' '}
                <span className="tabular text-[var(--text-muted)]">
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
      )}

      {settings?.canPersist === false ? (
        // 읽기 전용 배포에서는 저장 폼을 보여줄 이유가 없다. 눌러도 409 다.
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          이 서버는 설정 파일에 쓸 수 없다. 환경변수{' '}
          <code className="font-[family-name:var(--font-mono)]">OPENAI_API_KEY</code> 로
          설정할 것.
        </p>
      ) : (
        <>
          <Field
            label="새 API 키"
            error={error}
            hint={
              <>
                키는 <strong>서버에만</strong> 저장된다. 브라우저로 다시 내려오지 않는다.
                <code className="font-[family-name:var(--font-mono)]"> sk-</code> 로 시작하는
                평면 키를 넣는다 — <code>[openai]</code> 테이블 형식은 인식되지 않는다.
              </>
            }
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
                className={CONTROL_CLASS}
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
              onClick={save}
            >
              저장
            </Button>
            <Button variant="ghost" onClick={onClose}>
              닫기
            </Button>
            {saved && (
              <span role="status" className="text-sm text-[var(--color-up)]">
                저장했다. 서버를 다시 켜지 않아도 바로 쓸 수 있다.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
