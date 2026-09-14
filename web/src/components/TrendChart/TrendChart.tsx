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
 * 대상 대학은 accent, 비교선은 중립색을 돌려 쓴다.
 */
const EMPHASIS_STROKE = 'var(--accent)'
const MUTED_STROKES = ['var(--color-neutral)', 'var(--border-strong)', 'var(--text-muted)']

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
      <div
        data-testid="trend-skeleton"
        aria-hidden="true"
        style={{ height }}
        className="
          w-full animate-pulse rounded-[var(--radius-lg)]
          border border-[var(--border-subtle)] bg-[var(--surface-sunken)]
        "
      />
    )
  }

  if (!hasAnyValue(series)) {
    return (
      <div
        style={{ height }}
        className="
          flex w-full items-center justify-center
          rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)]
          bg-[var(--surface-raised)] text-sm text-[var(--text-muted)]
        "
      >
        표시할 데이터가 없다.
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
            <XAxis
              dataKey="year"
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              tickLine={false}
              width={64}
              label={{
                value: valueLabel,
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'var(--text-muted)', fontSize: 12 },
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
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
                stroke={s.emphasis ? EMPHASIS_STROKE : MUTED_STROKES[i % MUTED_STROKES.length]}
                strokeWidth={s.emphasis ? 2.5 : 1.5}
                strokeDasharray={s.emphasis ? undefined : '4 4'}
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
