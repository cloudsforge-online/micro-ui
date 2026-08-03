import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useId, useState, } from 'react';
/**
 * Coordinates are rounded to two decimals throughout.
 *
 * Not cosmetic: a path built from raw floats differs in its last digits between architectures,
 * which makes the emitted `d` attribute untestable and every server-rendered page a diff against
 * itself on hydration.
 */
const r2 = (n) => Math.round(n * 100) / 100;
/** Smallest and largest value in a series, with the flat-series case handled. */
export function extentOf(values) {
    if (values.length === 0)
        return { min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const v of values) {
        if (!Number.isFinite(v))
            continue;
        if (v < min)
            min = v;
        if (v > max)
            max = v;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max))
        return { min: 0, max: 0 };
    return { min, max };
}
/**
 * Project a series into the plot box: index across x, value up y.
 *
 * A flat series is drawn along the vertical middle rather than pinned to the floor or the
 * ceiling. Pinning it to the floor is how a chart of a stable balance comes out looking like a
 * chart of a balance that hit zero.
 */
export function plotPoints(values, box) {
    const n = values.length;
    if (n === 0)
        return [];
    const { min, max } = extentOf(values);
    const span = max - min;
    const left = box.padX;
    const right = box.width - box.padX;
    const top = box.padY;
    const bottom = box.height - box.padY;
    const usable = bottom - top;
    return values.map((v, i) => {
        const x = n === 1 ? (left + right) / 2 : left + ((right - left) * i) / (n - 1);
        const ratio = span === 0 ? 0.5 : (v - min) / span;
        return { x: r2(x), y: r2(bottom - ratio * usable) };
    });
}
/** `M x y L x y …` for a polyline. An empty series yields an empty string, never `M NaN NaN`. */
export function linePath(points) {
    if (points.length === 0)
        return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
}
/** The same polyline, closed down to a baseline, for the fill under an area chart. */
export function areaPath(points, baselineY) {
    if (points.length === 0)
        return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath(points)} L${r2(last.x)} ${r2(baselineY)} L${r2(first.x)} ${r2(baselineY)} Z`;
}
/**
 * A horizontal bar: square where it meets the baseline, rounded at the DATA END.
 *
 * The rounding is on the data end only because the baseline end is not data — it is the axis. A
 * bar rounded at both ends reads as a capsule floating near an axis rather than a quantity
 * measured from one, and at short lengths it also over-reads: 4px of radius on a 6px bar is most
 * of the bar.
 */
export function barPath(x, y, w, h, radius = 4) {
    if (!(w > 0) || !(h > 0))
        return '';
    const r = r2(Math.min(radius, w, h / 2));
    const x2 = r2(x + w);
    const y2 = r2(y + h);
    const rx = r2(x);
    const ry = r2(y);
    if (r <= 0)
        return `M${rx} ${ry} H${x2} V${y2} H${rx} Z`;
    return `M${rx} ${ry} H${r2(x2 - r)} A${r} ${r} 0 0 1 ${x2} ${r2(ry + r)} V${r2(y2 - r)} A${r} ${r} 0 0 1 ${r2(x2 - r)} ${y2} H${rx} Z`;
}
/**
 * Lay stacked segments out along a track, leaving a gap between them.
 *
 * The gap is 2px and is drawn in the SURFACE colour rather than by shrinking the fills into a
 * darker seam, because a seam made of a darker tint reads as a ninth category. Segments are
 * clamped to at least 1px so a 0.3% holding is visible as a sliver rather than absent — an
 * allocation chart that silently drops the smallest row is a chart that lies about the total.
 */
export function stackLayout(values, trackWidth, gap = 2) {
    const total = values.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0);
    if (total <= 0 || values.length === 0)
        return [];
    const gaps = gap * Math.max(0, values.length - 1);
    const usable = Math.max(0, trackWidth - gaps);
    let cursor = 0;
    return values.map((v) => {
        const share = v > 0 ? v / total : 0;
        const width = Math.max(share > 0 ? 1 : 0, usable * share);
        const seg = { x: r2(cursor), width: r2(width) };
        cursor += width + gap;
        return seg;
    });
}
export function chartState(count, error) {
    if (error !== undefined && error !== null)
        return 'failed';
    return count > 0 ? 'ok' : 'empty';
}
/**
 * The two non-plot states, which are deliberately different shapes as well as different words.
 *
 * Empty is quiet: muted text on a dashed baseline, because nothing is wrong. Failed is loud: the
 * critical token, a square icon, and an explicit statement that this is a failure to load rather
 * than an absence of data. Icon AND label AND colour, per the accessibility rules — the status
 * colours are never the only channel.
 */
function ChartFallback({ state, emptyLabel, errorLabel }) {
    if (state === 'empty') {
        return (_jsxs("div", { className: "cf-chart__empty", role: "status", children: [_jsx("span", { className: "cf-chart__empty-rule", "aria-hidden": "true" }), _jsx("span", { className: "cf-chart__empty-text", children: emptyLabel })] }));
    }
    return (_jsxs("div", { className: "cf-chart__fail", role: "alert", children: [_jsx("span", { className: "cf-chart__fail-icon", "aria-hidden": "true", children: "\u25A0" }), _jsx("span", { className: "cf-chart__fail-text", children: errorLabel })] }));
}
/** The accessible, copyable, printable form of every chart in this file. */
function DataTable({ caption, rows, valueHeader = 'Value', format, }) {
    return (_jsxs("table", { className: "cf-chart__table", children: [_jsx("caption", { className: "cf-chart__table-caption", children: caption }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Label" }), _jsx("th", { scope: "col", children: valueHeader })] }) }), _jsx("tbody", { children: rows.map((d, i) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: d.label }), _jsx("td", { className: "cf-num", children: format(d.value) })] }, `${d.label}-${i}`))) })] }));
}
/** Grouped, at most two decimals, fixed locale so a server render matches its client render. */
export function formatValue(n) {
    if (!Number.isFinite(n))
        return '—';
    return n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}
export function Sparkline({ values, label, width = 120, height = 28, color = 'var(--cf-viz-1)', error = null, emptyLabel = 'No readings in this window', errorLabel = 'Could not load this series', tableView = false, formatValue: fmt = formatValue, }) {
    const state = chartState(values.length, error);
    if (tableView) {
        return (_jsx(DataTable, { caption: label, rows: values.map((v, i) => ({ label: String(i + 1), value: v })), format: fmt }));
    }
    if (state !== 'ok') {
        return _jsx(ChartFallback, { state: state, emptyLabel: emptyLabel, errorLabel: errorLabel });
    }
    const box = { width, height, padX: 2, padY: 3 };
    const points = plotPoints(values, box);
    const last = points[points.length - 1];
    return (_jsxs("svg", { className: "cf-spark", width: width, height: height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${label}: ${fmt(values[values.length - 1] ?? 0)}`, fill: "none", children: [_jsx("path", { d: linePath(points), stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }), last && (_jsx("circle", { cx: last.x, cy: last.y, r: "2.5", fill: color, stroke: "var(--cf-viz-surface)", strokeWidth: "2" }))] }));
}
export function AreaChart({ data, title, pricedAt, height = 200, width = 640, color = 'var(--cf-viz-1)', error = null, emptyLabel = 'No points in this window', errorLabel = 'Could not load this chart', tableView = false, formatValue: fmt = formatValue, }) {
    const [hover, setHover] = useState(null);
    const clipId = useId();
    const state = chartState(data.length, error);
    if (tableView)
        return _jsx(DataTable, { caption: title, rows: data, format: fmt });
    if (state !== 'ok') {
        return (_jsxs("figure", { className: "cf-chart", children: [_jsx(ChartHeader, { title: title, pricedAt: pricedAt }), _jsx(ChartFallback, { state: state, emptyLabel: emptyLabel, errorLabel: errorLabel })] }));
    }
    const box = { width, height, padX: 4, padY: 8 };
    const values = data.map((d) => d.value);
    const points = plotPoints(values, box);
    const baseline = height - box.padY;
    const { min, max } = extentOf(values);
    // Horizontal grid only, and only three lines: a grid dense enough to read a value off is a
    // table wearing a chart's clothes.
    const gridYs = [box.padY, (box.padY + baseline) / 2, baseline];
    const onMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width === 0)
            return;
        const ratio = (e.clientX - rect.left) / rect.width;
        const idx = Math.round(ratio * (data.length - 1));
        setHover(Math.min(data.length - 1, Math.max(0, idx)));
    };
    const active = hover === null ? null : points[hover];
    const activeDatum = hover === null ? null : data[hover];
    return (_jsxs("figure", { className: "cf-chart", children: [_jsx(ChartHeader, { title: title, pricedAt: pricedAt }), _jsxs("div", { className: "cf-chart__plot", children: [_jsxs("svg", { className: "cf-chart__svg", viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", role: "img", "aria-label": `${title}, ${data.length} points, from ${fmt(min)} to ${fmt(max)}`, fill: "none", onPointerMove: onMove, onPointerLeave: () => setHover(null), children: [_jsx("defs", { children: _jsx("clipPath", { id: clipId, children: _jsx("rect", { x: "0", y: "0", width: width, height: height }) }) }), gridYs.map((y) => (_jsx("line", { x1: "0", x2: width, y1: y, y2: y, stroke: "var(--cf-viz-grid)", strokeWidth: "1" }, y))), _jsx("path", { d: areaPath(points, baseline), fill: color, opacity: "0.14", clipPath: `url(#${clipId})` }), _jsx("path", { d: linePath(points), stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }), active && (_jsxs(_Fragment, { children: [_jsx("line", { x1: active.x, x2: active.x, y1: box.padY, y2: baseline, stroke: "var(--cf-viz-axis)", strokeWidth: "1" }), _jsx("circle", { cx: active.x, cy: active.y, r: "3.5", fill: color, stroke: "var(--cf-viz-surface)", strokeWidth: "2" })] }))] }), active && activeDatum && (_jsxs("div", { className: "cf-chart__tip", style: { left: `${(active.x / width) * 100}%` }, role: "status", children: [_jsx("span", { className: "cf-chart__tip-label", children: activeDatum.label }), _jsx("span", { className: "cf-chart__tip-value cf-num", children: fmt(activeDatum.value) })] }))] }), _jsxs("div", { className: "cf-chart__axis", "aria-hidden": "true", children: [_jsx("span", { children: data[0]?.label }), _jsx("span", { children: data[data.length - 1]?.label })] })] }));
}
function ChartHeader({ title, pricedAt }) {
    return (_jsxs("figcaption", { className: "cf-chart__head", children: [_jsx("span", { className: "cf-chart__title", children: title }), pricedAt && _jsx("span", { className: "cf-chart__stamp cf-num", children: pricedAt })] }));
}
/** Sort descending and fold the tail into "Other", preserving the total. Exported for tests. */
export function foldBars(data, maxBars = 8) {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    if (sorted.length <= maxBars)
        return sorted;
    const head = sorted.slice(0, maxBars - 1);
    const tail = sorted.slice(maxBars - 1);
    return [...head, { label: 'Other', value: tail.reduce((a, d) => a + d.value, 0) }];
}
/**
 * Horizontal bars, sorted, direct-labelled. The allocation chart, and deliberately not a pie:
 * a pie asks a reader to compare angles, which they cannot do, in exchange for a shape.
 *
 * Every bar is ONE colour. Colouring nominal bars by their own value spends the identity channel
 * on information the bar's length already carries, and then has nothing left for identity.
 */
export function BarChart({ data, title, maxBars = 8, pricedAt, error = null, emptyLabel = 'Nothing held in this account', errorLabel = 'Could not load these balances', tableView = false, formatValue: fmt = formatValue, }) {
    const rows = foldBars(data, maxBars);
    const state = chartState(rows.length, error);
    if (tableView)
        return _jsx(DataTable, { caption: title, rows: rows, format: fmt });
    if (state !== 'ok') {
        return (_jsxs("figure", { className: "cf-chart", children: [_jsx(ChartHeader, { title: title, pricedAt: pricedAt }), _jsx(ChartFallback, { state: state, emptyLabel: emptyLabel, errorLabel: errorLabel })] }));
    }
    const max = extentOf(rows.map((r) => r.value)).max;
    const trackW = 100;
    const barH = 10;
    return (_jsxs("figure", { className: "cf-chart", children: [_jsx(ChartHeader, { title: title, pricedAt: pricedAt }), _jsx("ul", { className: "cf-bars", children: rows.map((row, i) => {
                    const w = max > 0 ? (row.value / max) * trackW : 0;
                    return (_jsxs("li", { className: "cf-bars__row", children: [_jsx("svg", { className: "cf-bars__track", viewBox: `0 0 ${trackW} ${barH}`, preserveAspectRatio: "none", "aria-hidden": "true", fill: "none", children: _jsx("path", { d: barPath(0, 0, w, barH, 4), fill: "var(--cf-viz-1)" }) }), _jsx("span", { className: "cf-bars__label", children: row.label }), _jsx("span", { className: "cf-bars__value cf-num", children: fmt(row.value) })] }, `${row.label}-${i}`));
                }) })] }));
}
/**
 * A signed change, with an arrow AND a word as well as a colour.
 *
 * The word is what makes this readable under deuteranopia, where the gain and loss tokens
 * separate by lightness but a reader still should not have to measure lightness to learn the
 * sign of their own P&L.
 */
export function Delta({ value, unit = '', epsilon = 0, formatValue: fmt = formatValue }) {
    const flat = Math.abs(value) <= epsilon;
    const up = value > 0;
    const tone = flat ? 'var(--cf-viz-mid)' : up ? 'var(--cf-viz-gain)' : 'var(--cf-viz-loss)';
    const icon = flat ? '■' : up ? '▲' : '▼';
    const word = flat ? 'unchanged' : up ? 'up' : 'down';
    const style = { '--cf-delta-tone': tone };
    return (_jsxs("span", { className: `cf-delta cf-delta--${flat ? 'flat' : up ? 'up' : 'down'}`, style: style, children: [_jsx("span", { className: "cf-delta__icon", "aria-hidden": "true", children: icon }), _jsxs("span", { className: "cf-sr", children: [word, " "] }), _jsxs("span", { className: "cf-delta__value cf-num", children: [fmt(Math.abs(value)), unit] })] }));
}
export function StatTile({ label, value, delta, deltaUnit = '%', pricedAt, error = null, emptyLabel = 'Not yet measured', errorLabel = 'Could not load', children, }) {
    const state = chartState(value === null ? 0 : 1, error);
    return (_jsxs("div", { className: "cf-tile", children: [_jsx("span", { className: "cf-tile__label", children: label }), state === 'ok' ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "cf-tile__value cf-num", children: value }), delta !== undefined && _jsx(Delta, { value: delta, unit: deltaUnit }), children && _jsx("div", { className: "cf-tile__plot", children: children })] })) : (_jsx(ChartFallback, { state: state, emptyLabel: emptyLabel, errorLabel: errorLabel })), pricedAt && state === 'ok' && _jsx("span", { className: "cf-tile__stamp cf-num", children: pricedAt })] }));
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
];
/**
 * One stacked track: composition of a whole, at a glance.
 *
 * The segments are separated by 2px of the SURFACE colour, which is the estate's rule for every
 * stacked fill and every pair of adjacent bars. Past eight segments the caller folds to "Other"
 * with `foldBars` — a ninth slot is not generated, because the slot order IS the CVD guarantee
 * and a generated hue has no place in it.
 */
export function Meter({ data, label, colors = VIZ_SLOTS, error = null, emptyLabel = 'Nothing allocated', errorLabel = 'Could not load this breakdown', tableView = false, formatValue: fmt = formatValue, }) {
    const state = chartState(data.length, error);
    if (tableView)
        return _jsx(DataTable, { caption: label, rows: data, format: fmt });
    if (state !== 'ok') {
        return (_jsxs("div", { className: "cf-chart", children: [_jsx("span", { className: "cf-chart__title", children: label }), _jsx(ChartFallback, { state: state, emptyLabel: emptyLabel, errorLabel: errorLabel })] }));
    }
    const trackW = 100;
    const segments = stackLayout(data.map((d) => d.value), trackW, 2);
    const total = data.reduce((a, d) => a + d.value, 0);
    return (_jsxs("div", { className: "cf-chart", children: [_jsx("span", { className: "cf-chart__title", children: label }), _jsx("svg", { className: "cf-meter", viewBox: `0 0 ${trackW} 8`, preserveAspectRatio: "none", role: "img", "aria-label": `${label}: ${data.map((d) => `${d.label} ${fmt(d.value)}`).join(', ')}`, children: segments.map((seg, i) => (_jsx("rect", { x: seg.x, y: "0", width: seg.width, height: "8", rx: "1", fill: colors[i % colors.length] ?? 'var(--cf-viz-1)' }, `${data[i]?.label ?? ''}-${i}`))) }), _jsx("ul", { className: "cf-meter__key", children: data.map((d, i) => (_jsxs("li", { className: "cf-meter__key-row", children: [_jsx("span", { className: "cf-meter__swatch", "aria-hidden": "true", style: { background: colors[i % colors.length] ?? 'var(--cf-viz-1)' } }), _jsx("span", { className: "cf-meter__name", children: d.label }), _jsx("span", { className: "cf-meter__value cf-num", children: total > 0 ? `${Math.round((d.value / total) * 100)}%` : '—' })] }, `${d.label}-${i}`))) })] }));
}
//# sourceMappingURL=charts.js.map