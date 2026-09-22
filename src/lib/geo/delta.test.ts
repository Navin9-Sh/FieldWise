import { describe, expect, it } from 'vitest'
import { createBoundary } from './boundary'
import { acceptEdgeRisk, applyWalkedEdgeCorrection, DeltaError, revokeAcceptedRisk } from './delta'
import { polygonAreaM2 } from './math'
import type { LatLng, LocalPoint } from './types'

// delta.ts is coordinate-system agnostic — it never projects or measures
// anything itself, it just splices points into a vertex ring. So these
// tests treat LatLng's lon/lat fields as plain x/y meters, which keeps
// the numbers easy to reason about without setting up a real projection.
const square: LatLng[] = [
  { lon: 0, lat: 0 },
  { lon: 10, lat: 0 },
  { lon: 10, lat: 10 },
  { lon: 0, lat: 10 },
]

function asLocal(vertices: LatLng[]): LocalPoint[] {
  return vertices.map((v) => ({ x: v.lon, y: v.lat }))
}

describe('applyWalkedEdgeCorrection', () => {
  it('adds a strip when the walked trace falls outside the boundary', () => {
    const boundary = createBoundary(square, 'satellite-trace', { imageryDate: '2024-01-01' })
    const bottomEdge = boundary.edges.find((e) => e.fromIndex === 0 && e.toIndex === 1)!

    // A newly-planted strip below the satellite-drawn bottom edge (y=0 -> y=-2).
    const walked: LatLng[] = [
      { lon: 3, lat: -2 },
      { lon: 7, lat: -2 },
    ]

    const updated = applyWalkedEdgeCorrection(boundary, bottomEdge.id, walked, 3)

    const oldArea = polygonAreaM2(asLocal(boundary.vertices))
    const newArea = polygonAreaM2(asLocal(updated.vertices))
    expect(newArea).toBeGreaterThan(oldArea)

    // The original edge is gone, replaced by a walked chain (2 points -> 3 edges).
    expect(updated.edges.find((e) => e.id === bottomEdge.id)).toBeUndefined()
    const newEdges = updated.edges.filter((e) => e.id.startsWith(`${bottomEdge.id}-walk`))
    expect(newEdges).toHaveLength(3)
    expect(newEdges.every((e) => e.provenance.kind === 'walked' && e.provenance.accuracyM === 3)).toBe(true)
  })

  it('trims the boundary when the walked trace falls inside it', () => {
    const boundary = createBoundary(square, 'satellite-trace', { imageryDate: '2024-01-01' })
    const bottomEdge = boundary.edges.find((e) => e.fromIndex === 0 && e.toIndex === 1)!

    // The satellite overestimated the field — actual edge is 2m further in (y=0 -> y=2).
    const walked: LatLng[] = [
      { lon: 3, lat: 2 },
      { lon: 7, lat: 2 },
    ]

    const updated = applyWalkedEdgeCorrection(boundary, bottomEdge.id, walked, 4)

    const oldArea = polygonAreaM2(asLocal(boundary.vertices))
    const newArea = polygonAreaM2(asLocal(updated.vertices))
    expect(newArea).toBeLessThan(oldArea)
  })

  it('leaves every other edge — id, indices, and provenance — untouched', () => {
    const boundary = createBoundary(square, 'satellite-trace', { imageryDate: '2024-01-01' })
    const bottomEdge = boundary.edges.find((e) => e.fromIndex === 0 && e.toIndex === 1)!
    const otherEdges = boundary.edges.filter((e) => e.id !== bottomEdge.id)

    const updated = applyWalkedEdgeCorrection(boundary, bottomEdge.id, [{ lon: 5, lat: -1 }], 3)

    for (const before of otherEdges) {
      const after = updated.edges.find((e) => e.id === before.id)
      expect(after).toBeDefined()
      expect(after!.provenance).toEqual(before.provenance)
    }
    // Total edge count: 3 untouched + (1 walked point -> 2 new edges).
    expect(updated.edges).toHaveLength(otherEdges.length + 2)
  })

  it('splices correctly across the wrap-around edge (last vertex -> first vertex)', () => {
    const boundary = createBoundary(square, 'satellite-trace', { imageryDate: '2024-01-01' })
    const wrapEdge = boundary.edges.find((e) => e.fromIndex === 3 && e.toIndex === 0)!

    const updated = applyWalkedEdgeCorrection(boundary, wrapEdge.id, [{ lon: -2, lat: 5 }], 3)

    // Original 4 vertices + 1 inserted; the untouched edges (indices 0,1,2 -> 1,2,3) still close the ring.
    expect(updated.vertices).toHaveLength(5)
    const newArea = polygonAreaM2(asLocal(updated.vertices))
    const oldArea = polygonAreaM2(asLocal(boundary.vertices))
    expect(newArea).toBeGreaterThan(oldArea) // bulges outward past x=0

    // 3 untouched edges + 2 replacing the wrap edge (1 inserted point -> 2 edges).
    expect(updated.edges).toHaveLength(5)
  })

  it('throws for an unknown edge id', () => {
    const boundary = createBoundary(square, 'satellite-trace', { imageryDate: '2024-01-01' })
    expect(() => applyWalkedEdgeCorrection(boundary, 'nope', [{ lon: 1, lat: 1 }], 3)).toThrow(DeltaError)
  })

  it('throws when given an empty trace', () => {
    const boundary = createBoundary(square, 'satellite-trace', { imageryDate: '2024-01-01' })
    expect(() => applyWalkedEdgeCorrection(boundary, boundary.edges[0].id, [], 3)).toThrow(DeltaError)
  })
})

describe('acceptEdgeRisk', () => {
  it('sets acceptedRisk without changing geometry, edge count, or provenance.kind', () => {
    const boundary = createBoundary(square, 'satellite-trace', { imageryDate: '2024-01-01' })
    const edge = boundary.edges[0]

    const updated = acceptEdgeRisk(boundary, edge.id)

    expect(updated.vertices).toEqual(boundary.vertices)
    expect(updated.edges).toHaveLength(boundary.edges.length)

    const updatedEdge = updated.edges.find((e) => e.id === edge.id)!
    expect(updatedEdge.provenance.kind).toBe('satellite') // still satellite, not "walked" — this is the whole distinction
    expect(updatedEdge.provenance.acceptedRisk).toBe(true)

    for (const other of boundary.edges.filter((e) => e.id !== edge.id)) {
      expect(updated.edges.find((e) => e.id === other.id)!.provenance).toEqual(other.provenance)
    }
  })

  it('throws when accepting risk on an edge that is not a satellite prior', () => {
    const boundary = createBoundary(square, 'gps-walk', { accuracyM: 3 })
    expect(() => acceptEdgeRisk(boundary, boundary.edges[0].id)).toThrow(DeltaError)
  })
})

describe('revokeAcceptedRisk', () => {
  it('reverses acceptEdgeRisk', () => {
    const boundary = createBoundary(square, 'satellite-trace', { imageryDate: '2024-01-01' })
    const edge = boundary.edges[0]

    const accepted = acceptEdgeRisk(boundary, edge.id)
    const revoked = revokeAcceptedRisk(accepted, edge.id)

    expect(revoked.edges.find((e) => e.id === edge.id)!.provenance.acceptedRisk).toBe(false)
  })
})
