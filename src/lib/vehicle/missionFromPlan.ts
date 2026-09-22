/**
 * Flattens a SprayPlan into a flat MAVLink waypoint list for upload.
 *
 * Known simplification: this sends every leg (spray and transit alike)
 * as a plain NAV_WAYPOINT at a constant altitude — it does not emit a
 * servo/relay command to turn the actual sprayer on and off at spray-leg
 * boundaries, since that's payload-specific (which output pin, which
 * PWM values) and out of scope for this pass. The boundary/coverage
 * geometry uploads and reads back correctly; actuating the sprayer from
 * the mission is a follow-up, not something this function claims to do.
 */
import type { LocalProjection } from '@/lib/geo/projection'
import type { SprayPlan } from '@/lib/geo/types'
import { MAV_CMD_NAV_WAYPOINT } from './mavlink/messages'
import type { MissionWaypoint } from './types'

export function sprayPlanToWaypoints(plan: SprayPlan, projection: LocalProjection, altitudeM: number): MissionWaypoint[] {
  const localPoints: { x: number; y: number }[] = []

  for (const sortie of plan.sorties) {
    for (const pass of sortie.passes) {
      const last = localPoints[localPoints.length - 1]
      if (!last || last.x !== pass.start.x || last.y !== pass.start.y) {
        localPoints.push(pass.start)
      }
      localPoints.push(pass.end)
    }
  }

  return localPoints.map((p, seq) => ({
    seq,
    position: projection.toLatLng(p),
    altM: altitudeM,
    command: MAV_CMD_NAV_WAYPOINT,
  }))
}
