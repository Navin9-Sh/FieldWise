/**
 * The demo's "Load sample field" preset. Deliberately reuses the exact
 * L-shaped field + pond from scenario.test.ts, so the numbers shown in
 * the UI are the same ones already verified by the geometry-core test
 * suite — no risk of the demo and the tests silently drifting apart.
 */
import { createBoundary } from './boundary'
import type { FieldBoundary, LatLng, NoSprayZone, SweepStrategy } from './types'

export const SAMPLE_FIELD_VERTICES: LatLng[] = [
  { lon: 76.6, lat: 12.3 },
  { lon: 76.6025, lat: 12.3 },
  { lon: 76.6025, lat: 12.301 },
  { lon: 76.6015, lat: 12.301 },
  { lon: 76.6015, lat: 12.3018 },
  { lon: 76.6, lat: 12.3018 },
]

export const SAMPLE_POND_VERTICES: LatLng[] = [
  { lon: 76.6005, lat: 12.3002 },
  { lon: 76.601, lat: 12.3002 },
  { lon: 76.601, lat: 12.3006 },
  { lon: 76.6005, lat: 12.3006 },
]

/** Roughly the centroid of the sample field — used as the map's initial camera target. */
export const SAMPLE_FIELD_CENTER: LatLng = { lon: 76.60133, lat: 12.30093 }

export interface SampleFieldPreset {
  boundary: FieldBoundary
  noSprayZones: NoSprayZone[]
  sweepStrategy: SweepStrategy
}

export function loadSampleField(): SampleFieldPreset {
  const boundary = createBoundary(SAMPLE_FIELD_VERTICES, 'satellite-trace', { imageryDate: '2024-11-01' })

  // The notch's closing edge (v4 -> v5) is pre-marked as walked, standing
  // in for "the pilot already corrected this edge" — so the readiness
  // gate has something real to show (partially cleared) without first
  // requiring a live correction pass.
  const walkedEdge = boundary.edges.find((e) => e.fromIndex === 4 && e.toIndex === 5)
  if (walkedEdge) {
    walkedEdge.provenance = { kind: 'walked', accuracyM: 2.1, verifiedAt: new Date().toISOString() }
  }

  const noSprayZones: NoSprayZone[] = [{ id: 'pond-1', label: 'Pond', vertices: SAMPLE_POND_VERTICES }]

  return {
    boundary,
    noSprayZones,
    sweepStrategy: { kind: 'min-turns' },
  }
}
