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
import { type ReactNode } from 'react';
export interface Point {
    readonly x: number;
    readonly y: number;
}
/** The plot area. Padding is inside the box, so a 2px stroke never clips at the edge. */
export interface PlotBox {
    readonly width: number;
    readonly height: number;
    readonly padX: number;
    readonly padY: number;
}
/** Smallest and largest value in a series, with the flat-series case handled. */
export declare function extentOf(values: readonly number[]): {
    min: number;
    max: number;
};
/**
 * Project a series into the plot box: index across x, value up y.
 *
 * A flat series is drawn along the vertical middle rather than pinned to the floor or the
 * ceiling. Pinning it to the floor is how a chart of a stable balance comes out looking like a
 * chart of a balance that hit zero.
 */
export declare function plotPoints(values: readonly number[], box: PlotBox): Point[];
/** `M x y L x y …` for a polyline. An empty series yields an empty string, never `M NaN NaN`. */
export declare function linePath(points: readonly Point[]): string;
/** The same polyline, closed down to a baseline, for the fill under an area chart. */
export declare function areaPath(points: readonly Point[], baselineY: number): string;
/**
 * A horizontal bar: square where it meets the baseline, rounded at the DATA END.
 *
 * The rounding is on the data end only because the baseline end is not data — it is the axis. A
 * bar rounded at both ends reads as a capsule floating near an axis rather than a quantity
 * measured from one, and at short lengths it also over-reads: 4px of radius on a 6px bar is most
 * of the bar.
 */
export declare function barPath(x: number, y: number, w: number, h: number, radius?: number): string;
/**
 * Lay stacked segments out along a track, leaving a gap between them.
 *
 * The gap is 2px and is drawn in the SURFACE colour rather than by shrinking the fills into a
 * darker seam, because a seam made of a darker tint reads as a ninth category. Segments are
 * clamped to at least 1px so a 0.3% holding is visible as a sliver rather than absent — an
 * allocation chart that silently drops the smallest row is a chart that lies about the total.
 */
export declare function stackLayout(values: readonly number[], trackWidth: number, gap?: number): Array<{
    x: number;
    width: number;
}>;
/**
 * Which of the three states a chart is in.
 *
 * `failed` outranks `empty`: a request that threw has told us nothing about whether data exists,
 * and reporting "no data" for a timeout is how an outage gets read as a quiet week.
 */
export type ChartState = 'ok' | 'empty' | 'failed';
export declare function chartState(count: number, error?: unknown | null): ChartState;
export interface ChartStatusProps {
    /** Anything non-null renders the FAILED state. Pass the caught error, not a boolean flag. */
    error?: unknown | null;
    /** Shown when the query answered with nothing. Say what was asked, not "no data". */
    emptyLabel?: string;
    /** Shown when the query did not answer at all. */
    errorLabel?: string;
    /** Render the numbers as a table instead of a plot. */
    tableView?: boolean;
}
export interface ChartDatum {
    readonly label: string;
    readonly value: number;
}
/** Grouped, at most two decimals, fixed locale so a server render matches its client render. */
export declare function formatValue(n: number): string;
export interface SparklineProps extends ChartStatusProps {
    readonly values: readonly number[];
    /** Accessible name. A sparkline with no name is a decoration, and decorations do not carry data. */
    readonly label: string;
    readonly width?: number;
    readonly height?: number;
    /**
     * Series colour. Defaults to --cf-viz-1. A single-series chart ABOUT one product may pass that
     * product's accent, which is the one sanctioned overlap between the brand and chart palettes:
     * with one series there is no identity work left for colour to do.
     */
    readonly color?: string;
    readonly formatValue?: (n: number) => string;
}
export declare function Sparkline({ values, label, width, height, color, error, emptyLabel, errorLabel, tableView, formatValue: fmt, }: SparklineProps): import("react").JSX.Element;
export interface AreaChartProps extends ChartStatusProps {
    readonly data: readonly ChartDatum[];
    /** The title names the series, which is why a single-series chart carries no legend. */
    readonly title: string;
    /**
     * When the values are prices or balances, the moment they were priced.
     *
     * Not optional in spirit: the oracle can be stale by up to PAY_ORACLE_MAX_AGE_SECONDS, and a
     * balance chart that hides when it was priced is a chart that lies by omission.
     */
    readonly pricedAt?: string;
    readonly height?: number;
    readonly width?: number;
    readonly color?: string;
    readonly formatValue?: (n: number) => string;
}
export declare function AreaChart({ data, title, pricedAt, height, width, color, error, emptyLabel, errorLabel, tableView, formatValue: fmt, }: AreaChartProps): import("react").JSX.Element;
export interface BarChartProps extends ChartStatusProps {
    readonly data: readonly ChartDatum[];
    readonly title: string;
    /**
     * Rows past this fold into "Other". Eight, because a ninth categorical slot does not exist and
     * inventing one is how a palette stops being a palette.
     */
    readonly maxBars?: number;
    readonly pricedAt?: string;
    readonly formatValue?: (n: number) => string;
}
/** Sort descending and fold the tail into "Other", preserving the total. Exported for tests. */
export declare function foldBars(data: readonly ChartDatum[], maxBars?: number): ChartDatum[];
/**
 * Horizontal bars, sorted, direct-labelled. The allocation chart, and deliberately not a pie:
 * a pie asks a reader to compare angles, which they cannot do, in exchange for a shape.
 *
 * Every bar is ONE colour. Colouring nominal bars by their own value spends the identity channel
 * on information the bar's length already carries, and then has nothing left for identity.
 */
export declare function BarChart({ data, title, maxBars, pricedAt, error, emptyLabel, errorLabel, tableView, formatValue: fmt, }: BarChartProps): import("react").JSX.Element;
export interface DeltaProps {
    /** The change itself, not the new total. */
    readonly value: number;
    /** Rendered after the number: "%", " EMBER", and so on. */
    readonly unit?: string;
    /** Treated as no change. Defaults to exactly zero. */
    readonly epsilon?: number;
    readonly formatValue?: (n: number) => string;
}
/**
 * A signed change, with an arrow AND a word as well as a colour.
 *
 * The word is what makes this readable under deuteranopia, where the gain and loss tokens
 * separate by lightness but a reader still should not have to measure lightness to learn the
 * sign of their own P&L.
 */
export declare function Delta({ value, unit, epsilon, formatValue: fmt }: DeltaProps): import("react").JSX.Element;
export interface StatTileProps extends ChartStatusProps {
    readonly label: string;
    /** Pre-formatted, because a tile shows one number and the caller knows its units. */
    readonly value: string | null;
    readonly delta?: number;
    readonly deltaUnit?: string;
    /** When the value is priced rather than counted, when it was priced. */
    readonly pricedAt?: string;
    /** Usually a Sparkline. A bare tile with no plot is the one place hover is not required. */
    readonly children?: ReactNode;
}
export declare function StatTile({ label, value, delta, deltaUnit, pricedAt, error, emptyLabel, errorLabel, children, }: StatTileProps): import("react").JSX.Element;
export interface MeterProps extends ChartStatusProps {
    readonly data: readonly ChartDatum[];
    readonly label: string;
    /** Series colours, in slot order. Never cycled: see the eight-slot rule in tokens.css. */
    readonly colors?: readonly string[];
    readonly formatValue?: (n: number) => string;
}
/**
 * One stacked track: composition of a whole, at a glance.
 *
 * The segments are separated by 2px of the SURFACE colour, which is the estate's rule for every
 * stacked fill and every pair of adjacent bars. Past eight segments the caller folds to "Other"
 * with `foldBars` — a ninth slot is not generated, because the slot order IS the CVD guarantee
 * and a generated hue has no place in it.
 */
export declare function Meter({ data, label, colors, error, emptyLabel, errorLabel, tableView, formatValue: fmt, }: MeterProps): import("react").JSX.Element;
