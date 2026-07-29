import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  areaPath,
  barPath,
  chartState,
  extentOf,
  foldBars,
  formatValue,
  linePath,
  plotPoints,
  stackLayout,
} from './charts.tsx'

/**
 * The chart components cannot be rendered without a DOM, but the part of them that can be wrong
 * in a way a reader would notice is the geometry, and the geometry is pure. These assert on the
 * emitted `d` attribute directly: a path is the one artefact of a chart that is exactly checkable.
 */

describe('extentOf', () => {
  it('finds the range', () => {
    assert.deepEqual(extentOf([3, -1, 7]), { min: -1, max: 7 })
  })

  it('answers zero for an empty series rather than Infinity', () => {
    assert.deepEqual(extentOf([]), { min: 0, max: 0 })
  })

  it('ignores non-finite readings instead of poisoning the range', () => {
    assert.deepEqual(extentOf([1, Number.NaN, 5]), { min: 1, max: 5 })
    assert.deepEqual(extentOf([Number.NaN]), { min: 0, max: 0 })
  })
})

describe('plotPoints', () => {
  const box = { width: 100, height: 50, padX: 0, padY: 0 }

  it('spreads the series across x and inverts the value up y', () => {
    assert.deepEqual(plotPoints([0, 5, 10], box), [
      { x: 0, y: 50 },
      { x: 50, y: 25 },
      { x: 100, y: 0 },
    ])
  })

  it('honours the padding, so a 2px stroke does not clip at the edge', () => {
    assert.deepEqual(plotPoints([0, 10], { width: 100, height: 50, padX: 4, padY: 8 }), [
      { x: 4, y: 42 },
      { x: 96, y: 8 },
    ])
  })

  it('draws a flat series down the middle, not along the floor', () => {
    // A stable balance pinned to the floor reads as a balance that hit zero.
    assert.deepEqual(plotPoints([7, 7, 7], box), [
      { x: 0, y: 25 },
      { x: 50, y: 25 },
      { x: 100, y: 25 },
    ])
  })

  it('centres a single reading', () => {
    assert.deepEqual(plotPoints([4], box), [{ x: 50, y: 25 }])
  })

  it('yields nothing for an empty series', () => {
    assert.deepEqual(plotPoints([], box), [])
  })
})

describe('linePath and areaPath', () => {
  const points = plotPoints([0, 5, 10], { width: 100, height: 50, padX: 0, padY: 0 })

  it('emits a polyline', () => {
    assert.equal(linePath(points), 'M0 50 L50 25 L100 0')
  })

  it('closes the area down to the baseline', () => {
    assert.equal(areaPath(points, 50), 'M0 50 L50 25 L100 0 L100 50 L0 50 Z')
  })

  it('emits an empty string rather than a path full of NaN', () => {
    assert.equal(linePath([]), '')
    assert.equal(areaPath([], 50), '')
  })
})

describe('barPath', () => {
  it('rounds the data end and squares the baseline end', () => {
    // 4px radius on the right; the left edge meets the axis flat, because the axis is not data.
    assert.equal(barPath(0, 0, 50, 10, 4), 'M0 0 H46 A4 4 0 0 1 50 4 V6 A4 4 0 0 1 46 10 H0 Z')
  })

  it('clamps the radius so a short bar does not become a capsule', () => {
    assert.equal(barPath(0, 0, 3, 10, 4), 'M0 0 H0 A3 3 0 0 1 3 3 V7 A3 3 0 0 1 0 10 H0 Z')
  })

  it('draws nothing for a zero or negative value', () => {
    assert.equal(barPath(0, 0, 0, 10), '')
    assert.equal(barPath(0, 0, -5, 10), '')
  })

  it('falls back to a rectangle when the radius is zero', () => {
    assert.equal(barPath(0, 0, 50, 10, 0), 'M0 0 H50 V10 H0 Z')
  })
})

describe('stackLayout', () => {
  it('leaves a 2px gap between segments, in the surface colour', () => {
    const segs = stackLayout([50, 50], 100, 2)
    assert.deepEqual(segs, [
      { x: 0, width: 49 },
      { x: 51, width: 49 },
    ])
    // The track is still exactly full: the gaps come out of the fills, not out of the total.
    const last = segs[segs.length - 1]
    assert.equal((last?.x ?? 0) + (last?.width ?? 0), 100)
  })

  it('keeps a sliver visible rather than dropping the smallest holding', () => {
    const segs = stackLayout([999, 1], 100, 2)
    assert.ok((segs[1]?.width ?? 0) >= 1)
  })

  it('yields nothing when there is nothing allocated', () => {
    assert.deepEqual(stackLayout([], 100), [])
    assert.deepEqual(stackLayout([0, 0], 100), [])
  })
})

describe('chartState', () => {
  it('separates an empty answer from a failure to answer', () => {
    assert.equal(chartState(0), 'empty')
    assert.equal(chartState(3), 'ok')
    assert.equal(chartState(0, new Error('timeout')), 'failed')
  })

  it('lets a failure outrank data, because a throw tells us nothing about the data', () => {
    assert.equal(chartState(3, 'upstream 503'), 'failed')
  })

  it('treats an explicit null error as no error', () => {
    assert.equal(chartState(3, null), 'ok')
    assert.equal(chartState(0, null), 'empty')
  })
})

describe('foldBars', () => {
  it('sorts descending', () => {
    assert.deepEqual(
      foldBars([
        { label: 'a', value: 1 },
        { label: 'b', value: 5 },
        { label: 'c', value: 3 },
      ]).map((d) => d.label),
      ['b', 'c', 'a'],
    )
  })

  it('folds the tail into Other, preserving the total', () => {
    const folded = foldBars(
      [
        { label: 'a', value: 1 },
        { label: 'b', value: 5 },
        { label: 'c', value: 3 },
      ],
      2,
    )
    assert.deepEqual(folded, [
      { label: 'b', value: 5 },
      { label: 'Other', value: 4 },
    ])
  })

  it('never returns a ninth categorical slot at the default cap', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ label: `s${i}`, value: i + 1 }))
    assert.equal(foldBars(many).length, 8)
    assert.equal(foldBars(many)[7]?.label, 'Other')
  })

  it('leaves the array the caller passed in alone', () => {
    const input = [
      { label: 'a', value: 1 },
      { label: 'b', value: 5 },
    ]
    foldBars(input)
    assert.deepEqual(input.map((d) => d.label), ['a', 'b'])
  })
})

describe('formatValue', () => {
  it('groups and caps the decimals', () => {
    assert.equal(formatValue(1234.567), '1,234.57')
    assert.equal(formatValue(0), '0')
  })

  it('shows a dash rather than NaN', () => {
    assert.equal(formatValue(Number.NaN), '—')
    assert.equal(formatValue(Number.POSITIVE_INFINITY), '—')
  })
})
