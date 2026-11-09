import { useEffect, useRef, useState } from 'react'

import { Combobox } from '../../../components/Combobox'
import { CompareGroupPicker } from '../../../components/CompareGroupPicker'
import { YearPicker } from '../../../components/YearPicker'
import { Button, Field, CONTROL_CLASS } from '../../../design/ui'
import { useRegionUniversities, useUniversityRegions } from '../hooks'
import type { StepProps } from './types'

/**
 * 1단계: 분석 대상 고르기.
 *
 * 여기서 고치는 것이 사용자가 "사라졌다" 고 한 기능들이다.
 *
 * | 잃었던 것 | 원본 | 이관 직후 | 지금 |
 * |---|---|---|---|
 * | 대학 선택 | 134개 목록 selectbox | 자유 텍스트(오타=404) | 검색 콤보박스 |
 * | 권역 선택 | 다캠퍼스면 선택 위젯 | 없음(서버가 조용히 판정) | 둘 이상이면 선택 |
 * | 비교군 | multiselect | 없음(서버 기본값 고정) | 체크박스 목록 |
 *
 * **입력은 전부 여기 지역 상태로 들고 있다가 "분석하기" 에서 한 번에 확정한다.**
 * 고를 때마다 스토어에 밀어 넣으면 "대학은 바꿨는데 비교군은 이전 것" 같은
 * 중간 상태가 생기고, 그게 V17 이 났던 모양이다.
 */
export function Step1Target({ state, dataset, actions }: StepProps) {
  const latestYear = dataset?.years[dataset.years.length - 1] ?? null

  const [university, setUniversity] = useState<string | null>(state.university)
  const [year, setYear] = useState<number | null>(state.year)
  const [regionChoice, setRegionChoice] = useState<string | null>(state.regionChoice)
  // 서버가 확정해 돌려준 비교군에는 **대상 자신이 맨 앞에** 들어 있다.
  // 후보 목록에는 자신이 없으므로 빼야 "N개교 선택" 숫자가 화면과 맞는다.
  const [compareGroup, setCompareGroup] = useState<readonly string[] | null>(() =>
    state.compareGroup
      ? state.compareGroup.filter((name) => name !== state.university)
      : null,
  )

  // 분석 연도. `null` 이면 전 연도 — 서버도 생략을 그렇게 읽는다.
  const [years, setYears] = useState<readonly number[] | null>(state.years)

  const availableYears = dataset?.years ?? []
  const effectiveYears = years && years.length > 0 ? years : availableYears

  const effectiveYear = year ?? latestYear

  /**
   * 연도 선택이 바뀌었다. 기준 연도가 선택 밖으로 나가면 데려온다.
   *
   * 그대로 두면 서버가 422 로 막는데(기준 연도는 분석 연도 안에 있어야 한다),
   * 화면에는 왜 막혔는지 보이지 않는다. 고칠 수 있는 어긋남은 화면에서 고친다.
   *
   * 전부 해제하면 전 연도로 되돌린다. 0개년은 보여줄 것이 없는 상태이고,
   * 비교군 선택도 같은 규칙으로 동작한다.
   */
  function handleYears(next: readonly number[]) {
    setYears(next.length > 0 ? next : null)
    if (next.length > 0 && effectiveYear !== null && !next.includes(effectiveYear)) {
      setYear(next[next.length - 1])
    }
  }

  const regions = useUniversityRegions(university)
  // 권역이 하나뿐이면 고를 것이 없다 — 그 하나가 곧 답이다.
  const onlyRegion = regions.data?.length === 1 ? regions.data[0] : null
  const effectiveRegion = regionChoice ?? onlyRegion

  // 대학·권역·연도가 **바뀌면** 이전 선택은 의미가 없다.
  //
  // `useEffect` 는 처음 마운트될 때도 돈다. 그대로 두면 2단계에서 1단계로
  // 돌아올 때마다 선택이 지워지는데, 화면에는 "기본 비교군" 이라고 뜨면서
  // 서버에는 여전히 고른 비교군으로 분석된 결과가 남아 있다. 그 상태에서
  // 다시 "분석하기" 를 누르면 **말없이 기본 비교군으로 바뀐다** — 방금
  // 서버에서 고친 것과 같은 종류의 사고다.
  //
  // 그래서 "바뀌었는가" 를 직접 본다. 마운트는 변화가 아니다.
  const prevUniversity = useRef(university)
  useEffect(() => {
    if (prevUniversity.current === university) return
    prevUniversity.current = university
    setRegionChoice(null)
    setCompareGroup(null)
  }, [university])

  const prevScope = useRef({ region: effectiveRegion, year: effectiveYear })
  useEffect(() => {
    const prev = prevScope.current
    prevScope.current = { region: effectiveRegion, year: effectiveYear }

    // 권역이 `null` 이었다가 풀린 것은 **바뀐 것이 아니다** — `/api/regions`
    // 조회가 끝났을 뿐이다. 이걸 변화로 세면 1단계로 돌아올 때마다 선택이
    // 사라진다(권역은 늘 null 에서 시작하므로 매번 걸린다).
    if (prev.region === null || effectiveRegion === null) return
    if (prev.region === effectiveRegion && prev.year === effectiveYear) return

    setCompareGroup(null)
  }, [effectiveRegion, effectiveYear])

  const candidates = useRegionUniversities(effectiveRegion, effectiveYear)

  const needsRegion = (regions.data?.length ?? 0) > 1 && regionChoice === null
  const canLoad = Boolean(university && effectiveYear && !needsRegion && !state.loading)

  return (
    <div className="flex flex-col gap-[var(--spacing-6)]">
      <div className="grid gap-[var(--spacing-5)] md:grid-cols-[2fr_1fr]">
        <Combobox
          label="대상 대학"
          data-testid="university-input"
          options={dataset?.universities ?? []}
          loading={!dataset}
          value={university}
          onChange={setUniversity}
          placeholder="대학 이름 검색"
          hint={
            dataset && latestYear
              ? `${latestYear}년 공시 기준 ${dataset.universityCount}개교 · 연도마다 집계 대학이 다릅니다`
              : undefined
          }
        />

        <Field label="기준 연도" hint="비교표와 전년 대비 증감의 기준 연도입니다.">
          {(field) => (
            <select
              {...field}
              data-testid="year-select"
              value={effectiveYear ?? ''}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={!dataset}
              className={`${CONTROL_CLASS} tabular font-[family-name:var(--font-numeric)]`}
            >
              {/* 고른 연도 안에서만 고를 수 있다. 원본도 기준 연도 선택지를
                  분석 연도로 제한했다(research.py:627). 제한하지 않으면
                  화면에 없는 해가 기준이 되어 서버가 막는다. */}
              {effectiveYears.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {/* 분석 연도 — 이관에서 통째로 빠져 있던 것이다. 없으면 추이·평균·순위가
          언제나 전 연도로 그려져, 최근 몇 년만 보는 방법이 없다.

          `Field` 를 쓰지 않는 이유: `Field` 는 `<label htmlFor>` 을 다는데
          연도 선택은 단일 컨트롤이 아니라 버튼 묶음이다. 가리킬 대상이 없는
          라벨이 되어 접근성 검사가 걸린다. 묶음은 스스로 이름을 갖는다
          (`role="group" aria-label`). */}
      <div className="flex flex-col gap-[var(--spacing-2)]">
        <p className="eyebrow m-0 text-[var(--text-secondary)]">분석 연도</p>
        <YearPicker
          available={availableYears}
          value={effectiveYears}
          onChange={handleYears}
          baseYear={effectiveYear}
        />
        {/* 목록이 오기 전에는 그리지 않는다. "지금은 0개년 전부입니다" 로 읽힌다. */}
        {dataset && (
          <p data-testid="year-summary" className="m-0 text-meta text-[var(--text-muted)]">
            {effectiveYears.length === availableYears.length
              ? `추이·평균·순위에 들어갈 해입니다. 지금은 ${availableYears.length}개년 전부입니다.`
              : `${effectiveYears.length}개년 선택 · 전체 ${availableYears.length}개년`}
          </p>
        )}
      </div>

      {/* 권역은 **둘 이상일 때만** 묻는다. 하나뿐인데 고르라고 하면 의미
          없는 선택을 강요하는 것이다. */}
      {(regions.data?.length ?? 0) > 1 && (
        <Field
          label="권역"
          hint={`${university}는 캠퍼스가 여러 권역에 있습니다. 기준 캠퍼스를 고르면 권역 순위와 평균이 정해집니다.`}
          error={needsRegion ? '권역을 고르면 분석할 수 있습니다' : null}
        >
          {(field) => (
            <select
              {...field}
              data-testid="region-select"
              value={regionChoice ?? ''}
              onChange={(e) => setRegionChoice(e.target.value || null)}
              className={CONTROL_CLASS}
            >
              <option value="">권역 선택</option>
              {regions.data?.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {university && effectiveRegion && (
        <div className="flex flex-col gap-[var(--spacing-3)]">
          <h3 className="m-0 text-heading font-semibold text-[var(--text-primary)]">비교군</h3>
          <p className="m-0 text-body text-[var(--text-secondary)]">
            「비교군 비교」 절과 비교 차트에 들어가는 대학입니다. 고르지 않으면 권역 상위
            대학으로 채웁니다.
          </p>
          <CompareGroupPicker
            rows={candidates.data ?? []}
            target={university}
            value={compareGroup}
            onChange={setCompareGroup}
            loading={candidates.loading}
            error={candidates.error}
            regionName={effectiveRegion}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-[var(--spacing-4)]">
        {/* 검은 버튼은 한 화면에 하나다. 이미 불러온 뒤에는 「다음」이 주 행동이고,
            여기는 "바꾼 것을 다시 반영" 하는 보조 행동이 된다. */}
        <Button
          variant={state.stats ? 'secondary' : 'primary'}
          size={state.stats ? 'md' : 'lg'}
          data-testid="load-button"
          disabled={!canLoad}
          busy={state.loading}
          busyLabel="불러오는 중…"
          onClick={() =>
            university &&
            effectiveYear &&
            actions.loadTarget({
              university,
              year: effectiveYear,
              regionChoice,
              compareGroup,
              years,
            })
          }
        >
          {state.stats ? '다시 분석' : '분석하기'}
        </Button>

        {state.stats && (
          <p data-testid="load-summary" className="m-0 text-body text-[var(--text-secondary)]">
            <strong className="font-semibold text-[var(--text-primary)]">{state.stats.university}</strong>
            {' · '}
            {state.stats.regionName} · 기준 {state.stats.year}년 · 분석{' '}
            {state.stats.years.length}개년 · 비교군 {state.stats.compareGroup.length}개교
          </p>
        )}
      </div>

      {state.stats?.compareGroupNote && (
        <p data-testid="compare-note" className="m-0 text-meta text-[var(--text-muted)]">
          {state.stats.compareGroupNote}
        </p>
      )}
    </div>
  )
}
