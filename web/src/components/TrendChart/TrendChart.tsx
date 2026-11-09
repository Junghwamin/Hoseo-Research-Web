import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatValue, hasAnyValue, toChartRows } from './transform'
import type { TrendChartProps } from './types'

/**
 * 계열 색. tokens.css 의 변수를 참조한다 — 여기에 색 값을 쓰지 않는다(§12-1).
 * 대상 계열만 주홍(이 화면의 1회), 비교선은 회색 점선이다(DESIGN.md §7).
 */
const EMPHASIS_STROKE = 'var(--accent)'
// 비교선 셋. 글자색 둘과 굵은 선 색 하나 — 주홍 계열은 섞지 않는다. 색이 비슷해도
// 갈리도록 점선 패턴을 함께 돌린다.
const MUTED_STROKES = ['var(--text-secondary)', 'var(--text-muted)', 'var(--border-strong)']
const MUTED_DASHES = ['4 4', '2 3', '8 4']

/** 축 눈금 — 연도·숫자라 모노다. 크기는 캡션(12px)과 같다. */
const TICK = { fill: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }

/** i 번째 계열이 강조선을 제외하고 몇 번째 비교선인가. */
function mutedIndex(all: TrendChartProps['series'], i: number): number {
  return all.slice(0, i).filter((s) => !s.emphasis).length
}

export function TrendChart({
  series,
  valueLabel,
  description,
  precision = 4,
  loading = false,
  height = 320,
}: TrendChartProps) {
  if (loading) {
    return (
      // 스켈레톤은 sunken 면의 직각 블록 하나 — 차트와 같은 높이.
      <div
        data-testid="trend-skeleton"
        aria-hidden="true"
        style={{ height }}
        className="w-full animate-pulse bg-[var(--surface-sunken)]"
      />
    )
  }

  if (!hasAnyValue(series)) {
    return (
      <div
        style={{ height }}
        className="
          flex w-full items-center justify-center
          border border-dashed border-[var(--border-subtle)]
          bg-[var(--surface-raised)] text-body text-[var(--text-muted)]
        "
      >
        표시할 데이터가 없습니다.
      </div>
    )
  }

  const rows = toChartRows(series)

  return (
    <figure className="m-0 w-full">
      {/* SVG 는 스크린리더가 읽지 못한다. role=img + 설명으로 요지를 전달하고,
          정확한 수치는 아래 표가 담당한다. */}
      <div role="img" aria-label={description} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" stroke="var(--border-strong)" tick={TICK} tickLine={false} />
            <YAxis
              stroke="var(--border-strong)"
              tick={TICK}
              tickLine={false}
              width={64}
              label={{
                value: valueLabel,
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'var(--text-muted)', fontSize: 12 },
              }}
            />
            {/* 툴팁은 직각 + 하드 그림자 — 드롭다운과 같은 깊이 규칙이다. */}
            <Tooltip
              contentStyle={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-hard)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
              // recharts 는 ValueType(number|string|array)을 넘긴다. 숫자만 포맷한다.
              formatter={(v: unknown) =>
                typeof v === 'number' ? formatValue(v, precision) : formatValue(null, precision)
              }
              labelFormatter={(y) => `${y}년`}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
              iconType="plainline"
            />
            {series.map((s, i) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={
                  s.emphasis
                    ? EMPHASIS_STROKE
                    : MUTED_STROKES[mutedIndex(series, i) % MUTED_STROKES.length]
                }
                strokeWidth={s.emphasis ? 2.5 : 1.5}
                strokeDasharray={
                  s.emphasis ? undefined : MUTED_DASHES[mutedIndex(series, i) % MUTED_DASHES.length]
                }
                dot={{ r: s.emphasis ? 3 : 0 }}
                activeDot={{ r: 5 }}
                // null 구간에서 선을 잇지 않는다. 이으면 없는 데이터를 추정해
                // 그린 것처럼 보인다.
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 화면에는 감추고 스크린리더에만 노출한다. 수치를 잃지 않기 위해서다. */}
      <figcaption className="sr-only">
        <table>
          <caption>{description}</caption>
          <thead>
            <tr>
              <th scope="col">연도</th>
              {series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <th scope="row">{row.year}년</th>
                {series.map((s) => (
                  <td key={s.name}>{formatValue(row[s.name], precision)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  )
}
