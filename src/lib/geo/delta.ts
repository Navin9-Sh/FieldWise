/**
 * Delta corrections — the mechanism behind "not a full redraw". Every
 * correction here touches only the vertices/edges it needs to: the rest
 * of the boundary's geometry and provenance come back as the exact same
 * objects, untouched. That's what keeps a correction cheap enough to
 * re-plan after in ~1s, and what keeps the readiness gate's "N of M
 * edges" count meaningful instead of resetting on every edit.
 */
import type { BoundaryEdge, FieldBoundary, LatLng } from './types'

export class DeltaError extends Error {}

/**
 * Replaces one edge's geometry with a walked trace, splicing the trace's
 * points in as new vertices between that edge's two (unchanged) anchor
 * vertices. This single operation covers both directions the twist
 * describes: if the trace falls outside the original edge, the boundary
 * gains area (a newly-planted strip); if it falls inside, the boundary
 * loses area (a trim). The geometry doesn't need to know which case it
 * is — it's the same splice either way, which is why "walk a strip" and
 * "trim an edge" in the UI both call this one function.
 *
 * Every edge the splice creates is provenance 'walked'. Every edge NOT
 * touched by it — id, provenance object included — comes back exactly
 * as it was, just renumbered for the new vertex array.
 */
export function applyWalkedEdgeCorrection(
  boundary: FieldBoundary,
  edgeId: string,
  walkedPoints: LatLng[],
  accuracyM: number,
): FieldBoundary {
  const target = boundary.edges.find((e) => e.id === edgeId)
  if (!target) throw new DeltaError(`Unknown edge: ${edgeId}`)
  if (walkedPoints.length === 0) throw new DeltaError('A walked correction needs at least one point')

  const insertAfter = target.fromIndex
  const numInserted = walkedPoints.length
  const mapIndex = (oldIndex: number) => (oldIndex <= insertAfter ? oldIndex : oldIndex + numInserted)

  const vertices: LatLng[] = [
    ...boundary.vertices.slice(0, insertAfter + 1),
    ...walkedPoints,
    ...boundary.vertices.slice(insertAfter + 1),
  ]

  const verifiedAt = new Date().toISOString()
  const edges: BoundaryEdge[] = []
  let walkedSeq = 0

  for (const edge of boundary.edges) {
    if (edge.id !== edgeId) {
      edges.push({ ...edge, fromIndex: mapIndex(edge.fromIndex), toIndex: mapIndex(edge.toIndex) })
      continue
    }

    // Chain: (mapped fromIndex) -> insertedPoint0 -> ... -> insertedPointN -> (mapped toIndex).
    const chain = [
      mapIndex(edge.fromIndex),
      ...Array.from({ length: numInserted }, (_, i) => insertAfter + 1 + i),
      mapIndex(edge.toIndex),
    ]
    for (let i = 0; i < chain.length - 1; i++) {
      edges.push({
        id: `${edgeId}-walk${walkedSeq++}`,
        fromIndex: chain[i],
        toIndex: chain[i + 1],
        provenance: { kind: 'walked', accuracyM, verifiedAt },
      })
    }
  }

  return { ...boundary, vertices, edges }
}

/**
 * Marks an edge's risk as explicitly accepted without walking it. The
 * edge stays provenance 'satellite' — deliberately distinct from
 * 'walked' — so the readiness gate can keep counting it separately
 * (acceptedRiskEdges): "we looked at it and chose to fly anyway" is
 * never conflated with "we verified it".
 */
export function acceptEdgeRisk(boundary: FieldBoundary, edgeId: string): FieldBoundary {
  const target = boundary.edges.find((e) => e.id === edgeId)
  if (!target) throw new DeltaError(`Unknown edge: ${edgeId}`)
  if (target.provenance.kind !== 'satellite') {
    throw new DeltaError('Only an unverified (satellite) edge can have its risk accepted')
  }

  return {
    ...boundary,
    edges: boundary.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, provenance: { ...edge.provenance, acceptedRisk: true } } : edge,
    ),
  }
}

/** Undoes acceptEdgeRisk — lets the pilot change their mind before the flight clears. */
export function revokeAcceptedRisk(boundary: FieldBoundary, edgeId: string): FieldBoundary {
  const target = boundary.edges.find((e) => e.id === edgeId)
  if (!target) throw new DeltaError(`Unknown edge: ${edgeId}`)

  return {
    ...boundary,
    edges: boundary.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, provenance: { ...edge.provenance, acceptedRisk: false } } : edge,
    ),
  }
}
