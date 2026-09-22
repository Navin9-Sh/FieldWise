import { create } from 'zustand'
import { DEFAULT_DRONE_PROFILE } from '@/lib/geo/defaults'
import type {
  DroneProfile,
  FieldBoundary,
  NoSprayZone,
  ReadinessSummary,
  SprayPlan,
  SweepStrategy,
} from '@/lib/geo/types'

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

  /** Recomputed by the planner whenever boundary/zones/profile/strategy change. */
  sprayPlan: SprayPlan | null
  /** Recomputed by the readiness engine whenever boundary edge provenance changes. */
  readiness: ReadinessSummary | null

  setStep: (step: WorkflowStep) => void
  setBoundary: (boundary: FieldBoundary | null) => void
  addNoSprayZone: (zone: NoSprayZone) => void
  removeNoSprayZone: (id: string) => void
  setDroneProfile: (profile: DroneProfile) => void
  setSweepStrategy: (strategy: SweepStrategy) => void
  setSprayPlan: (plan: SprayPlan | null) => void
  setReadiness: (readiness: ReadinessSummary | null) => void
}

/**
 * Single source of truth for the field/plan session. This is a hackathon
 * MVP with no auth/backend, so state lives client-side only; persistence
 * to IndexedDB (saved fields/missions) hooks in here later without
 * changing the shape consumers see.
 *
 * NOTE: this store intentionally does *not* compute the spray plan or
 * readiness summary itself — those are pure functions in `lib/geo/`
 * (planner.ts, readiness.ts) that components call and feed back in via
 * setSprayPlan/setReadiness. Keeping derivation out of the store keeps the
 * ~1s re-plan-on-correction path easy to trace and test in isolation.
 */
export const useFieldStore = create<FieldState>((set) => ({
  currentStep: 'import',

  boundary: null,
  noSprayZones: [],
  droneProfile: DEFAULT_DRONE_PROFILE,
  sweepStrategy: { kind: 'min-turns' },

  sprayPlan: null,
  readiness: null,

  setStep: (step) => set({ currentStep: step }),
  setBoundary: (boundary) => set({ boundary }),
  addNoSprayZone: (zone) =>
    set((state) => ({ noSprayZones: [...state.noSprayZones, zone] })),
  removeNoSprayZone: (id) =>
    set((state) => ({ noSprayZones: state.noSprayZones.filter((z) => z.id !== id) })),
  setDroneProfile: (profile) => set({ droneProfile: profile }),
  setSweepStrategy: (strategy) => set({ sweepStrategy: strategy }),
  setSprayPlan: (plan) => set({ sprayPlan: plan }),
  setReadiness: (readiness) => set({ readiness }),
}))
