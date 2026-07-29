/**
 * @cloudsforge/ui/charts — the chart primitives the estate currently hand-rolls three times.
 *
 * Crucible ships its own equity chart, Beacon its own series colours and Lantern its own severity
 * bars; all three drew the same six shapes with different rules. These are those shapes, once,
 * obeying docs/ecosystem/assets/chart-palette.md section 7 by construction rather than by review:
 *
 *   - 2px lines, no shadow, no gradient stroke
 *   - 4px rounded data-ends on bars, square at the baseline
 *   - 2px gaps IN THE SURFACE COLOUR between stacked fills
 *   - labels, values and legends in text tokens, never in the series colour
 *   - no legend for a single series (the title names it)
 *   - horizontal grid only, behind the marks, and no axis line on the value axis
 *   - every value in --cf-font-mono, tabular
 *
 * Hand-rolled SVG on purpose: no chart library. A dependency here would arrive with its own
 * palette, its own type scale and its own opinion about legends, and the whole point of this file
 * is that those three things are already decided.
 *
 * Two rules are enforced in code rather than left to the caller:
 *
 *   1. AN EMPTY CHART AND A FAILED CHART MUST NOT LOOK THE SAME. Beacon and Lantern already
 *      distinguish "the query answered, with nothing" from "the query did not answer", and a
 *      shared primitive that collapsed the two would be a regression in both. See `chartState`.
 *   2. EVERY CHART HAS A TABLE FALLBACK. `tableView` renders the same numbers as a table, which
 *      is the accessible form, the copy-paste form and the printable form.
 *
 * There is deliberately no dual-axis anything. Hashrate and difficulty are two scales; two scales
 * are two panels.
 */
import {
  useId,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

/* ============================== geometry ========================== */

export interface Point {
  readonly x: number
  readonly y: number
}

/** The plot area. Padding is inside the box, so a 2px stroke never clips at the edge. */
export interface PlotBox {
  readonly width: number
  readonly height: number
  readonly padX: number
  readonly padY: number
}

/**
 * Coordinates are rounded to two decimals throughout.
 *
 * Not cosmetic: a path built from raw floats differs in its last digits between architectures,
 * which makes the emitted `d` attribute untestable and every server-rendered page a diff against
 * itself on hydration.
 */
const r2 = (n: number): number => Math.round(n * 100) / 100

/** Smallest and largest value in a series, with the flat-series case handled. */
export function extentOf(values: readonly number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 }
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0 }
  return { min, max }
}

/**
 * Project a series into the plot box: index across x, value up y.
 *
 * A flat series is drawn along the vertical middle rather than pinned to the floor or the
 * ceiling. Pinning it to the floor is how a chart of a stable balance comes out looking like a
 * chart of a balance that hit zero.
 */
export function plotPoints(values: readonly number[], box: PlotBox): Point[] {
  const n = values.length
  if (n === 0) return []
  const { min, max } = extentOf(values)
  const span = max - min
  const left = box.padX
  const right = box.width - box.padX
  const top = box.padY
  const bottom = box.height - box.padY
  const usable = bottom - top

  return values.map((v, i) => {
    const x = n === 1 ? (left + right) / 2 : left + ((right - left) * i) / (n - 1)
    const ratio = span === 0 ? 0.5 : (v - min) / span
    return { x: r2(x), y: r2(bottom - ratio * usable) }
  })
}

/** `M x y L x y …` for a polyline. An empty series yields an empty string, never `M NaN NaN`. */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
}

/** The same polyline, closed down to a baseline, for the fill under an area chart. */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length === 0) return ''
  const first = points[0] as Point
  const last = points[points.length - 1] as Point
  return `${linePath(points)} L${r2(last.x)} ${r2(baselineY)} L${r2(first.x)} ${r2(baselineY)} Z`
}

/**
 * A horizontal bar: square where it meets the baseline, rounded at the DATA END.
 *
 * The rounding is on the data end only because the baseline end is not data — it is the axis. A
 * bar rounded at both ends reads as a capsule floating near an axis rather than a quantity
 * measured from one, and at short lengths it also over-reads: 4px of radius on a 6px bar is most
 * of the bar.
 */
export function barPath(x: number, y: number, w: number, h: number, radius = 4): string {
  if (!(w > 0) || !(h > 0)) return ''
  const r = r2(Math.min(radius, w, h / 2))
  const x2 = r2(x + w)
  const y2 = r2(y + h)
  const rx = r2(x)
  const ry = r2(y)
  if (r <= 0) return `M${rx} ${ry} H${x2} V${y2} H${rx} Z`
  return `M${rx} ${ry} H${r2(x2 - r)} A${r} ${r} 0 0 1 ${x2} ${r2(ry + r)} V${r2(y2 - r)} A${r} ${r} 0 0 1 ${r2(x2 - r)} ${y2} H${rx} Z`
}

/**
 * Lay stacked segments out along a track, leaving a gap between them.
 *
 * The gap is 2px and is drawn in the SURFACE colour rather than by shrinking the fills into a
 * darker seam, because a seam made of a darker tint reads as a ninth category. Segments are
 * clamped to at least 1px so a 0.3% holding is visible as a sliver rather than absent — an
 * allocation chart that silently drops the smallest row is a chart that lies about the total.
 */
export function stackLayout(
  values: readonly number[],
  trackWidth: number,
  gap = 2,
): Array<{ x: number; width: number }> {
  const total = values.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0)
  if (total <= 0 || values.length === 0) return []
  const gaps = gap * Math.max(0, values.length - 1)
  const usable = Math.max(0, trackWidth - gaps)
  let cursor = 0
  return values.map((v) => {
    const share = v > 0 ? v / total : 0
    const width = Math.max(share > 0 ? 1 : 0, usable * share)
    const seg = { x: r2(cursor), width: r2(width) }
    cursor += width + gap
    return seg
  })
}

/* ========================= states, not styles ===================== */

/**
 * Which of the three states a chart is in.
 *
 * `failed` outranks `empty`: a request that threw has told us nothing about whether data exists,
 * and reporting "no data" for a timeout is how an outage gets read as a quiet week.
 */
export type ChartState = 'ok' | 'empty' | 'failed'

export function chartState(count: number, error?: unknown | null): ChartState {
  if (error !== undefined && error !== null) return 'failed'
  return count > 0 ? 'ok' : 'empty'
}

export interface ChartStatusProps {
  /** Anything non-null renders the FAILED state. Pass the caught error, not a boolean flag. */
  error?: unknown | null
  /** Shown when the query answered with nothing. Say what was asked, not "no data". */
  emptyLabel?: string
  /** Shown when the query did not answer at all. */
  errorLabel?: string
  /** Render the numbers as a table instead of a plot. */
  tableView?: boolean
}

/**
 * The two non-plot states, which are deliberately different shapes as well as different words.
 *
 * Empty is quiet: muted text on a dashed baseline, because nothing is wrong. Failed is loud: the
 * critical token, a square icon, and an explicit statement that this is a failure to load rather
 * than an absence of data. Icon AND label AND colour, per the accessibility rules — the status
 * colours are never the only channel.
 */
function ChartFallback({ state, emptyLabel, errorLabel }: { state: Exclude<ChartState, 'ok'>; emptyLabel: string; errorLabel: string }) {
  if (state === 'empty') {
    return (
      <div className="cf-chart__empty" role="status">
        <span className="cf-chart__empty-rule" aria-hidden="true" />
        <span className="cf-chart__empty-text">{emptyLabel}</span>
      </div>
    )
  }
  return (
    <div className="cf-chart__fail" role="alert">
      <span className="cf-chart__fail-icon" aria-hidden="true">
        ■
      </span>
      <span className="cf-chart__fail-text">{errorLabel}</span>
    </div>
  )
}

/** The accessible, copyable, printable form of every chart in this file. */
function DataTable({
  caption,
  rows,
  valueHeader = 'Value',
  format,
}: {
  caption: string
  rows: readonly ChartDatum[]
  valueHeader?: string
  format: (n: number) => string
}) {
  return (
    <table className="cf-chart__table">
      <caption className="cf-chart__table-caption">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d, i) => (
          <tr key={`${d.label}-${i}`}>
            <th scope="row">{d.label}</th>
            <td className="cf-num">{format(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ============================ formatting ========================== */

export interface ChartDatum {
  readonly label: string
  readonly value: number
}

/** Grouped, at most two decimals, fixed locale so a server render matches its client render. */
export function formatValue(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-GB', { maximumFractionDigits: 2 })
}

/* ============================ Sparkline =========================== */

export interface SparklineProps extends ChartStatusProps {
  readonly values: readonly number[]
  /** Accessible name. A sparkline with no name is a decoration, and decorations do not carry data. */
  readonly label: string
  readonly width?: number
  readonly height?: number
  /**
   * Series colour. Defaults to --cf-viz-1. A single-series chart ABOUT one product may pass that
   * product's accent, which is the one sanctioned overlap between the brand and chart palettes:
   * with one series there is no identity work left for colour to do.
   */
  readonly color?: string
  readonly formatValue?: (n: number) => string
}

export function Sparkline({
  values,
  label,
  width = 120,
  height = 28,
  color = 'var(--cf-viz-1)',
  error = null,
  emptyLabel = 'No readings in this window',
  errorLabel = 'Could not load this series',
  tableView = false,
  formatValue: fmt = formatValue,
}: SparklineProps) {
  const state = chartState(values.length, error)
  if (tableView) {
    return (
      <DataTable
        caption={label}
        rows={values.map((v, i) => ({ label: String(i + 1), value: v }))}
        format={fmt}
      />
    )
  }
  if (state !== 'ok') {
    return <ChartFallback state={state} emptyLabel={emptyLabel} errorLabel={errorLabel} />
  }

  const box: PlotBox = { width, height, padX: 2, padY: 3 }
  const points = plotPoints(values, box)
  const last = points[points.length - 1]

  return (
    <svg
      className="cf-spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${fmt(values[values.length - 1] ?? 0)}`}
      fill="none"
    >
      <path d={linePath(points)} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* The data end, ringed in the surface colour so it separates from the line it sits on. */}
      {last && (
        <circle
          cx={last.x}
          cy={last.y}
          r="2.5"
          fill={color}
          stroke="var(--cf-viz-surface)"
          strokeWidth="2"
        />
      )}
    </svg>
  )
}

/* ============================ AreaChart =========================== */

export interface AreaChartProps extends ChartStatusProps {
  readonly data: readonly ChartDatum[]
  /** The title names the series, which is why a single-series chart carries no legend. */
  readonly title: string
  /**
   * When the values are prices or balances, the moment they were priced.
   *
   * Not optional in spirit: the oracle can be stale by up to PAY_ORACLE_MAX_AGE_SECONDS, and a
   * balance chart that hides when it was priced is a chart that lies by omission.
   */
  readonly pricedAt?: string
  readonly height?: number
  readonly width?: number
  readonly color?: string
  readonly formatValue?: (n: number) => string
}

export function AreaChart({
  data,
  title,
  pricedAt,
  height = 200,
  width = 640,
  color = 'var(--cf-viz-1)',
  error = null,
  emptyLabel = 'No points in this window',
  errorLabel = 'Could not load this chart',
  tableView = false,
  formatValue: fmt = formatValue,
}: AreaChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const clipId = useId()
  const state = chartState(data.length, error)

  if (tableView) return <DataTable caption={title} rows={data} format={fmt} />
  if (state !== 'ok') {
    return (
      <figure className="cf-chart">
        <ChartHeader title={title} pricedAt={pricedAt} />
        <ChartFallback state={state} emptyLabel={emptyLabel} errorLabel={errorLabel} />
      </figure>
    )
  }

  const box: PlotBox = { width, height, padX: 4, padY: 8 }
  const values = data.map((d) => d.value)
  const points = plotPoints(values, box)
  const baseline = height - box.padY
  const { min, max } = extentOf(values)
  // Horizontal grid only, and only three lines: a grid dense enough to read a value off is a
  // table wearing a chart's clothes.
  const gridYs = [box.padY, (box.padY + baseline) / 2, baseline]

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = (e.clientX - rect.left) / rect.width
    const idx = Math.round(ratio * (data.length - 1))
    setHover(Math.min(data.length - 1, Math.max(0, idx)))
  }

  const active = hover === null ? null : points[hover]
  const activeDatum = hover === null ? null : data[hover]

  return (
    <figure className="cf-chart">
      <ChartHeader title={title} pricedAt={pricedAt} />
      <div className="cf-chart__plot">
        <svg
          className="cf-chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}, ${data.length} points, from ${fmt(min)} to ${fmt(max)}`}
          fill="none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={width} height={height} />
            </clipPath>
          </defs>
          {gridYs.map((y) => (
            <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="var(--cf-viz-grid)" strokeWidth="1" />
          ))}
          {/* The fill is the same hue at low alpha, never a gradient: a gradient encodes a
              second variable that does not exist. */}
          <path
            d={areaPath(points, baseline)}
            fill={color}
            opacity="0.14"
            clipPath={`url(#${clipId})`}
          />
          <path d={linePath(points)} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {active && (
            <>
              <line
                x1={active.x}
                x2={active.x}
                y1={box.padY}
                y2={baseline}
                stroke="var(--cf-viz-axis)"
                strokeWidth="1"
              />
              <circle
                cx={active.x}
                cy={active.y}
                r="3.5"
                fill={color}
                stroke="var(--cf-viz-surface)"
                strokeWidth="2"
              />
            </>
          )}
        </svg>
        {active && activeDatum && (
          <div
            className="cf-chart__tip"
            style={{ left: `${(active.x / width) * 100}%` }}
            role="status"
          >
            <span className="cf-chart__tip-label">{activeDatum.label}</span>
            <span className="cf-chart__tip-value cf-num">{fmt(activeDatum.value)}</span>
          </div>
        )}
      </div>
      <div className="cf-chart__axis" aria-hidden="true">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </figure>
  )
}

function ChartHeader({ title, pricedAt }: { title: string; pricedAt?: string | undefined }) {
  return (
    <figcaption className="cf-chart__head">
      <span className="cf-chart__title">{title}</span>
      {pricedAt && <span className="cf-chart__stamp cf-num">{pricedAt}</span>}
    </figcaption>
  )
}

/* ============================= BarChart =========================== */

export interface BarChartProps extends ChartStatusProps {
  readonly data: readonly ChartDatum[]
  readonly title: string
  /**
   * Rows past this fold into "Other". Eight, because a ninth categorical slot does not exist and
   * inventing one is how a palette stops being a palette.
   */
  readonly maxBars?: number
  readonly pricedAt?: string
  readonly formatValue?: (n: number) => string
}

/** Sort descending and fold the tail into "Other", preserving the total. Exported for tests. */
export function foldBars(data: readonly ChartDatum[], maxBars = 8): ChartDatum[] {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  if (sorted.length <= maxBars) return sorted
  const head = sorted.slice(0, maxBars - 1)
  const tail = sorted.slice(maxBars - 1)
  return [...head, { label: 'Other', value: tail.reduce((a, d) => a + d.value, 0) }]
}

/**
 * Horizontal bars, sorted, direct-labelled. The allocation chart, and deliberately not a pie:
 * a pie asks a reader to compare angles, which they cannot do, in exchange for a shape.
 *
 * Every bar is ONE colour. Colouring nominal bars by their own value spends the identity channel
 * on information the bar's length already carries, and then has nothing left for identity.
 */
export function BarChart({
  data,
  title,
  maxBars = 8,
  pricedAt,
  error = null,
  emptyLabel = 'Nothing held in this account',
  errorLabel = 'Could not load these balances',
  tableView = false,
  formatValue: fmt = formatValue,
}: BarChartProps) {
  const rows = foldBars(data, maxBars)
  const state = chartState(rows.length, error)

  if (tableView) return <DataTable caption={title} rows={rows} format={fmt} />
  if (state !== 'ok') {
    return (
      <figure className="cf-chart">
        <ChartHeader title={title} pricedAt={pricedAt} />
        <ChartFallback state={state} emptyLabel={emptyLabel} errorLabel={errorLabel} />
      </figure>
    )
  }

  const max = extentOf(rows.map((r) => r.value)).max
  const trackW = 100
  const barH = 10

  return (
    <figure className="cf-chart">
      <ChartHeader title={title} pricedAt={pricedAt} />
      <ul className="cf-bars">
        {rows.map((row, i) => {
          const w = max > 0 ? (row.value / max) * trackW : 0
          return (
            <li className="cf-bars__row" key={`${row.label}-${i}`}>
              <svg
                className="cf-bars__track"
                viewBox={`0 0 ${trackW} ${barH}`}
                preserveAspectRatio="none"
                aria-hidden="true"
                fill="none"
              >
                <path d={barPath(0, 0, w, barH, 4)} fill="var(--cf-viz-1)" />
              </svg>
              <span className="cf-bars__label">{row.label}</span>
              <span className="cf-bars__value cf-num">{fmt(row.value)}</span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

/* ============================== Delta ============================= */

export interface DeltaProps {
  /** The change itself, not the new total. */
  readonly value: number
  /** Rendered after the number: "%", " EMBER", and so on. */
  readonly unit?: string
  /** Treated as no change. Defaults to exactly zero. */
  readonly epsilon?: number
  readonly formatValue?: (n: number) => string
}

/**
 * A signed change, with an arrow AND a word as well as a colour.
 *
 * The word is what makes this readable under deuteranopia, where the gain and loss tokens
 * separate by lightness but a reader still should not have to measure lightness to learn the
 * sign of their own P&L.
 */
export function Delta({ value, unit = '', epsilon = 0, formatValue: fmt = formatValue }: DeltaProps) {
  const flat = Math.abs(value) <= epsilon
  const up = value > 0
  const tone = flat ? 'var(--cf-viz-mid)' : up ? 'var(--cf-viz-gain)' : 'var(--cf-viz-loss)'
  const icon = flat ? '■' : up ? '▲' : '▼'
  const word = flat ? 'unchanged' : up ? 'up' : 'down'
  const style = { '--cf-delta-tone': tone } as CSSProperties

  return (
    <span className={`cf-delta cf-delta--${flat ? 'flat' : up ? 'up' : 'down'}`} style={style}>
      <span className="cf-delta__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="cf-sr">{word} </span>
      <span className="cf-delta__value cf-num">
        {fmt(Math.abs(value))}
        {unit}
      </span>
    </span>
  )
}

/* ============================= StatTile =========================== */

export interface StatTileProps extends ChartStatusProps {
  readonly label: string
  /** Pre-formatted, because a tile shows one number and the caller knows its units. */
  readonly value: string | null
  readonly delta?: number
  readonly deltaUnit?: string
  /** When the value is priced rather than counted, when it was priced. */
  readonly pricedAt?: string
  /** Usually a Sparkline. A bare tile with no plot is the one place hover is not required. */
  readonly children?: ReactNode
}

export function StatTile({
  label,
  value,
  delta,
  deltaUnit = '%',
  pricedAt,
  error = null,
  emptyLabel = 'Not yet measured',
  errorLabel = 'Could not load',
  children,
}: StatTileProps) {
  const state = chartState(value === null ? 0 : 1, error)

  return (
    <div className="cf-tile">
      <span className="cf-tile__label">{label}</span>
      {state === 'ok' ? (
        <>
          <span className="cf-tile__value cf-num">{value}</span>
          {delta !== undefined && <Delta value={delta} unit={deltaUnit} />}
          {children && <div className="cf-tile__plot">{children}</div>}
        </>
      ) : (
        <ChartFallback state={state} emptyLabel={emptyLabel} errorLabel={errorLabel} />
      )}
      {pricedAt && state === 'ok' && <span className="cf-tile__stamp cf-num">{pricedAt}</span>}
    </div>
  )
}

/* ============================== Meter ============================= */

export interface MeterProps extends ChartStatusProps {
  readonly data: readonly ChartDatum[]
  readonly label: string
  /** Series colours, in slot order. Never cycled: see the eight-slot rule in tokens.css. */
  readonly colors?: readonly string[]
  readonly formatValue?: (n: number) => string
}

const VIZ_SLOTS = [
  'var(--cf-viz-1)',
  'var(--cf-viz-2)',
  'var(--cf-viz-3)',
  'var(--cf-viz-4)',
  'var(--cf-viz-5)',
  'var(--cf-viz-6)',
  'var(--cf-viz-7)',
  'var(--cf-viz-8)',
] as const

/**
 * One stacked track: composition of a whole, at a glance.
 *
 * The segments are separated by 2px of the SURFACE colour, which is the estate's rule for every
 * stacked fill and every pair of adjacent bars. Past eight segments the caller folds to "Other"
 * with `foldBars` — a ninth slot is not generated, because the slot order IS the CVD guarantee
 * and a generated hue has no place in it.
 */
export function Meter({
  data,
  label,
  colors = VIZ_SLOTS,
  error = null,
  emptyLabel = 'Nothing allocated',
  errorLabel = 'Could not load this breakdown',
  tableView = false,
  formatValue: fmt = formatValue,
}: MeterProps) {
  const state = chartState(data.length, error)
  if (tableView) return <DataTable caption={label} rows={data} format={fmt} />
  if (state !== 'ok') {
    return (
      <div className="cf-chart">
        <span className="cf-chart__title">{label}</span>
        <ChartFallback state={state} emptyLabel={emptyLabel} errorLabel={errorLabel} />
      </div>
    )
  }

  const trackW = 100
  const segments = stackLayout(
    data.map((d) => d.value),
    trackW,
    2,
  )
  const total = data.reduce((a, d) => a + d.value, 0)

  return (
    <div className="cf-chart">
      <span className="cf-chart__title">{label}</span>
      <svg
        className="cf-meter"
        viewBox={`0 0 ${trackW} 8`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${data.map((d) => `${d.label} ${fmt(d.value)}`).join(', ')}`}
      >
        {segments.map((seg, i) => (
          <rect
            key={`${data[i]?.label ?? ''}-${i}`}
            x={seg.x}
            y="0"
            width={seg.width}
            height="8"
            rx="1"
            fill={colors[i % colors.length] ?? 'var(--cf-viz-1)'}
          />
        ))}
      </svg>
      {/* Two or more series, so a legend is present — and it is direct-labelled as well, which
          is affordable at eight rows and removes the back-and-forth a legend alone demands. */}
      <ul className="cf-meter__key">
        {data.map((d, i) => (
          <li className="cf-meter__key-row" key={`${d.label}-${i}`}>
            <span
              className="cf-meter__swatch"
              aria-hidden="true"
              style={{ background: colors[i % colors.length] ?? 'var(--cf-viz-1)' }}
            />
            <span className="cf-meter__name">{d.label}</span>
            <span className="cf-meter__value cf-num">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
