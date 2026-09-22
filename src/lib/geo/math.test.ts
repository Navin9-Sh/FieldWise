import { describe, expect, it } from 'vitest'
import { convexHull, minTurnsHeadingRad, polygonAreaM2, scanlineSpans } from './math'
import type { LocalPoint } from './types'

describe('polygonAreaM2', () => {
  it('computes the area of a simple square', () => {
    const square: LocalPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(polygonAreaM2(square)).toBeCloseTo(100, 6)
  })
})

describe('convexHull', () => {
  it('drops interior points and keeps the hull', () => {
    const points: LocalPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 }, // interior — should be dropped
    ]
    const hull = convexHull(points)
    expect(hull).toHaveLength(4)
    expect(hull).not.toContainEqual({ x: 5, y: 5 })
  })
})

describe('minTurnsHeadingRad', () => {
  it('aligns with the long axis of a wide rectangle', () => {
    // 100m along x, 10m along y — sweeping along x (heading 0) crosses
    // only the 10m short dimension, minimizing pass count.
    const rect: LocalPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 10 },
      { x: 0, y: 10 },
    ]
    const heading = minTurnsHeadingRad(rect)
    expect(heading).toBeCloseTo(0, 3)
  })

  it('rotates with the field when the field is rotated', () => {
    // Same rectangle, rotated 90°: now 10m along x, 100m along y — the
    // long axis (and so the heading) should rotate with it.
    const rect: LocalPoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: -10, y: 100 },
      { x: -10, y: 0 },
    ]
    const heading = minTurnsHeadingRad(rect)
    expect(Math.abs(heading - Math.PI / 2)).toBeLessThan(0.01)
  })
})

describe('scanlineSpans', () => {
  it('returns a single span for a convex shape', () => {
    const square: LocalPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const spans = scanlineSpans([square], 5)
    expect(spans).toEqual([[0, 10]])
  })

  it('returns two spans for a scanline crossing a concave notch', () => {
    // A "U" shape: 0..30 wide, 0..20 tall, with a notch cut out of the
    // middle from y=10 upward (x: 10..20). A scanline at y=15 should hit
    // the left leg and the right leg as two separate spans.
    const u: LocalPoint[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 20, y: 20 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ]
    const spans = scanlineSpans([u], 15)
    expect(spans).toHaveLength(2)
    expect(spans[0]).toEqual([0, 10])
    expect(spans[1]).toEqual([20, 30])
  })

  it('excludes a hole ring (even-odd rule)', () => {
    const outer: LocalPoint[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ]
    const hole: LocalPoint[] = [
      { x: 8, y: 8 },
      { x: 12, y: 8 },
      { x: 12, y: 12 },
      { x: 8, y: 12 },
    ]
    const spans = scanlineSpans([outer, hole], 10)
    expect(spans).toEqual([
      [0, 8],
      [12, 20],
    ])
  })
})
