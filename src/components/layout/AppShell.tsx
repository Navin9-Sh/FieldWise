import type { ReactNode } from 'react'
import { ReadinessBadge } from './ReadinessBadge'
import { RecomputeTimingBadge } from './RecomputeTimingBadge'
import { Stepper } from './Stepper'
import { useFieldStore, type WorkflowStep, WORKFLOW_STEPS } from '@/store/useFieldStore'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const currentStep = useFieldStore((s) => s.currentStep)
  const setStep = useFieldStore((s) => s.setStep)
  const boundary = useFieldStore((s) => s.boundary)
  const sprayPlan = useFieldStore((s) => s.sprayPlan)
  const readiness = useFieldStore((s) => s.readiness)
  const lastRecomputeMs = useFieldStore((s) => s.lastRecomputeMs)

  // Gate later steps behind having the data they need — prevents the
  // pilot from landing on "Send to Vehicle" with nothing planned.
  const unlocked: WorkflowStep[] = WORKFLOW_STEPS.filter((step) => {
    if (step === 'import') return true
    if (step === 'verify') return boundary !== null
    if (step === 'plan') return boundary !== null
    if (step === 'simulate') return sprayPlan !== null
    if (step === 'send') return sprayPlan !== null
    return false
  })

  return (
    <div className="flex min-h-full flex-col bg-(--surface-app)">
      <header className="flex items-center justify-between gap-4 border-b border-(--border-subtle) bg-(--surface-panel) px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            FW
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-(--text-primary)">FieldWise</div>
            <div className="text-xs text-(--text-muted)">Field-Truth spray planning</div>
          </div>
        </div>

        <Stepper current={currentStep} unlocked={unlocked} onSelect={setStep} />

        <div className="flex items-center gap-2">
          <RecomputeTimingBadge lastRecomputeMs={lastRecomputeMs} />
          <ReadinessBadge readiness={readiness} />
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
