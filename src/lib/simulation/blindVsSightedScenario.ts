/**
 * The Simulate panel's demo scenario: a dedicated, self-contained ground
 * truth / satellite / corrected boundary triplet, distinct from whatever
 * the pilot has been doing in Import/Verify/Plan. This is deliberate —
 * the app doesn't keep a snapshot of "the boundary before any
 * correction" once a live edit has been applied (applyWalkedEdgeCorrection
 * replaces the corrected edge's vertices in place, see lib/geo/delta.ts),
 * so there's no honest way to reconstruct "what would the original
 * all-satellite plan have looked like" from an already-corrected live
 * session. Rather than fake that, this scenario tells the same story
 * with its own fixed before/after geometry, clearly a scripted
 * demonstration rather than a replay of the user's own edits.
 *
 * The satellite (blind) boundary differs from ground truth in both
 * directions the PS's twist describes: missing a strip (a newly-planted
 * area the stale imagery doesn't show) and overstepping an edge (a stale
 * crop line encroaching onto what's now neighboring land). The corrected
 * (sighted) boundary is a close-but-not-pixel-perfect match to ground
 * truth, representing a realistic GPS-walked correction.
 */
import { planSprayPath } from '@/lib/geo/planner'
import { createLocalProjection, unprojectAll, type LocalProjection } from '@/lib/geo/projection'
import type { DroneProfile, LatLng, LocalPoint, SprayPlan } from '@/lib/geo/types'
import { simulateSprayReplay, type ReplayResult } from './replay'

/** 200m x 100m = 2 ha — the true field. */
const GROUND_TRUTH_LOCAL: LocalPoint[] = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 100 },
  { x: 0, y: 100 },
]

/** Missing the right 20m (newly-planted strip) + overstepping the top 10m (stale crop line onto neighboring land). */
const SATELLITE_LOCAL: LocalPoint[] = [
  { x: 0, y: 0 },
  { x: 180, y: 0 },
  { x: 180, y: 110 },
  { x: 0, y: 110 },
]

/** A realistic GPS-walked correction — close to ground truth, not a pixel-perfect copy. */
const CORRECTED_LOCAL: LocalPoint[] = [
  { x: 0.4, y: -0.3 },
  { x: 199.6, y: 0.5 },
  { x: 199.8, y: 99.6 },
  { x: 0.2, y: 100.4 },
]

/** Near the sample field's own farmland location, offset enough not to overlap it on screen. */
const SCENARIO_ORIGIN: LatLng = { lon: 75.7525, lat: 30.3495 }

export interface BlindVsSightedScenario {
  projection: LocalProjection
  groundTruthLatLng: LatLng[]
  satelliteLatLng: LatLng[]
  correctedLatLng: LatLng[]
  blindPlan: SprayPlan
  sightedPlan: SprayPlan
  blindResult: ReplayResult
  sightedResult: ReplayResult
}

export function runBlindVsSightedScenario(droneProfile: DroneProfile): BlindVsSightedScenario {
  const projection = createLocalProjection(SCENARIO_ORIGIN)

  const sweepStrategy = { kind: 'min-turns' as const }
  const blindPlan = planSprayPath({ boundaryLocal: SATELLITE_LOCAL, noSprayZonesLocal: [], droneProfile, sweepStrategy })
  const sightedPlan = planSprayPath({ boundaryLocal: CORRECTED_LOCAL, noSprayZonesLocal: [], droneProfile, sweepStrategy })

  const blindResult = simulateSprayReplay({ groundTruthLocal: GROUND_TRUTH_LOCAL, plan: blindPlan, droneProfile })
  const sightedResult = simulateSprayReplay({ groundTruthLocal: GROUND_TRUTH_LOCAL, plan: sightedPlan, droneProfile })

  return {
    projection,
    groundTruthLatLng: unprojectAll(projection, GROUND_TRUTH_LOCAL),
    satelliteLatLng: unprojectAll(projection, SATELLITE_LOCAL),
    correctedLatLng: unprojectAll(projection, CORRECTED_LOCAL),
    blindPlan,
    sightedPlan,
    blindResult,
    sightedResult,
  }
}
