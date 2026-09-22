import { create } from 'zustand'
import { DEFAULT_DRONE_PROFILE } from '@/lib/geo/defaults'
import { planSprayPath } from '@/lib/geo/planner'
import {
  approximateCentroidLatLng,
  createLocalProjection,
  projectAll,
  type LocalProjection,
} from '@/lib/geo/projection'
import { computeReadiness } from '@/lib/geo/readiness'
import { loadSampleField } from '@/lib/geo/sampleField'
import type { DroneProfile, FieldBoundary, NoSprayZone, ReadinessSummary, SprayPlan, SweepStrategy } from '@/lib/geo/types'

/** The five-step pilot workflow, matches the header stepper 1:1. */
export const WORKFLOW_STEPS = ['import', 'verify', 'plan', 'simulate', 'send'] as const
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number]

export const STEP_LABELS: Record<WorkflowStep, string> = {
  import: 'Import',
  verify: 'Verify',
  plan: 'Plan',
  simulate: 'Simulate',
  send: 'Send to Vehicle',
}

interface FieldState {
  currentStep: WorkflowStep

  boundary: FieldBoundary | null
  noSprayZones: NoSprayZone[]
  droneProfile: DroneProfile
  sweepStrategy: SweepStrategy

  /** The boundary's local metric projection — recomputed (centered on the new centroid) whenever the boundary changes. */
  projection: LocalProjection | null
  /** Recomputed by the planner whenever boundary/zones/profile/strategy change. */
  sprayPlan: SprayPlan | null
  /** Recomputed by the readiness engine whenever boundary edge provenance changes. */
  readiness: ReadinessSummary | null

  /** The edge currently selected on the map/Verify list — read-only for now; the correction flow (next pass) will act on it. */
  selectedEdgeId: string | null

  setStep: (step: WorkflowStep) => void
  setBoundary: (boundary: FieldBoundary | null) => void
  addNoSprayZone: (zone: NoSprayZone) => void
  removeNoSprayZone: (id: string) => void
  setDroneProfile: (profile: DroneProfile) => void
  setSweepStrategy: (strategy: SweepStrategy) => void
  setSelectedEdgeId: (edgeId: string | null) => void
  loadSample: () => void
  reset: () => void
}

interface DerivedFields {
  projection: LocalProjection | null
  sprayPlan: SprayPlan | null
  readiness: ReadinessSummary | null
}

/**
 * Recomputes projection/plan/readiness from scratch. This is the one
 * place those three derived values are produced — every mutating action
 * below funnels through it so the map, the readiness badge, and the plan
 * stats are always in sync with each other within a single render, never
 * showing a stale plan next to a fresh boundary for one frame.
 *
 * Pure geometry-core functions do the real work (lib/geo/planner.ts,
 * readiness.ts); this is just wiring, which is what keeps the ~1s
 * re-plan-on-correction path traceable.
 */
function recompute(input: {
  boundary: FieldBoundary | null
  noSprayZones: NoSprayZone[]
  droneProfile: DroneProfile
  sweepStrategy: SweepStrategy
}): DerivedFields {
  const { boundary, noSprayZones, droneProfile, sweepStrategy } = input

  if (!boundary) {
    return { projection: null, sprayPlan: null, readiness: null }
  }

  const origin = approximateCentroidLatLng(boundary.vertices)
  const projection = createLocalProjection(origin)
  const boundaryLocal = projectAll(projection, boundary.vertices)
  const noSprayZonesLocal = noSprayZones.map((zone) => projectAll(projection, zone.vertices))

  const readiness = computeReadiness(boundary, boundaryLocal)
  const sprayPlan = planSprayPath({
    boundaryLocal,
    noSprayZonesLocal,
    droneProfile,
    sweepStrategy,
  })

  return { projection, sprayPlan, readiness }
}

const initialState = {
  currentStep: 'import' as WorkflowStep,
  boundary: null as FieldBoundary | null,
  noSprayZones: [] as NoSprayZone[],
  droneProfile: DEFAULT_DRONE_PROFILE,
  sweepStrategy: { kind: 'min-turns' } as SweepStrategy,
  projection: null as LocalProjection | null,
  sprayPlan: null as SprayPlan | null,
  readiness: null as ReadinessSummary | null,
  selectedEdgeId: null as string | null,
}

/**
 * Single source of truth for the field/plan session. This is a hackathon
 * MVP with no auth/backend, so state lives client-side only; persistence
 * to IndexedDB (saved fields/missions) hooks in here later without
 * changing the shape consumers see.
 */
export const useFieldStore = create<FieldState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  setBoundary: (boundary) =>
    set((state) => ({
      boundary,
      selectedEdgeId: null,
      ...recompute({ ...state, boundary }),
    })),

  addNoSprayZone: (zone) =>
    set((state) => {
      const noSprayZones = [...state.noSprayZones, zone]
      return { noSprayZones, ...recompute({ ...state, noSprayZones }) }
    }),

  removeNoSprayZone: (id) =>
    set((state) => {
      const noSprayZones = state.noSprayZones.filter((z) => z.id !== id)
      return { noSprayZones, ...recompute({ ...state, noSprayZones }) }
    }),

  setDroneProfile: (droneProfile) =>
    set((state) => ({ droneProfile, ...recompute({ ...state, droneProfile }) })),

  setSweepStrategy: (sweepStrategy) =>
    set((state) => ({ sweepStrategy, ...recompute({ ...state, sweepStrategy }) })),

  setSelectedEdgeId: (selectedEdgeId) => set({ selectedEdgeId }),

  loadSample: () => {
    const preset = loadSampleField()
    set((state) => ({
      boundary: preset.boundary,
      noSprayZones: preset.noSprayZones,
      sweepStrategy: preset.sweepStrategy,
      droneProfile: DEFAULT_DRONE_PROFILE,
      selectedEdgeId: null,
      ...recompute({
        boundary: preset.boundary,
        noSprayZones: preset.noSprayZones,
        droneProfile: DEFAULT_DRONE_PROFILE,
        sweepStrategy: preset.sweepStrategy,
      }),
      currentStep: state.currentStep === 'import' ? 'verify' : state.currentStep,
    }))
  },

  reset: () => set(initialState),
}))

// Exposed for callers (e.g. tests, devtools) that need a one-shot read
// without subscribing to the store.
export function getFieldStoreState() {
  return useFieldStore.getState()
}
