import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { FieldMap, type CorrectionTarget, type DrawTarget, type SimulateOverlay } from '@/components/map/FieldMap'
import { ExportPanel } from '@/components/panels/ExportPanel'
import { ImportPanel } from '@/components/panels/ImportPanel'
import { PlanPanel } from '@/components/panels/PlanPanel'
import { SendPanel } from '@/components/panels/SendPanel'
import { SimulatePanel } from '@/components/panels/SimulatePanel'
import { VerifyPanel } from '@/components/panels/VerifyPanel'
import { createBoundary } from '@/lib/geo/boundary'
import { headingDegBetween } from '@/lib/geo/projection'
import type { LatLng } from '@/lib/geo/types'
import { useFieldStore } from '@/store/useFieldStore'

function App() {
  const currentStep = useFieldStore((s) => s.currentStep)
  const boundary = useFieldStore((s) => s.boundary)
  const noSprayZones = useFieldStore((s) => s.noSprayZones)
  const sprayPlan = useFieldStore((s) => s.sprayPlan)
  const projection = useFieldStore((s) => s.projection)
  const selectedEdgeId = useFieldStore((s) => s.selectedEdgeId)
  const setSelectedEdgeId = useFieldStore((s) => s.setSelectedEdgeId)
  const setBoundary = useFieldStore((s) => s.setBoundary)
  const addNoSprayZone = useFieldStore((s) => s.addNoSprayZone)
  const walkEdge = useFieldStore((s) => s.walkEdge)
  const setSweepStrategy = useFieldStore((s) => s.setSweepStrategy)

  // Transient interaction UI state — shared between a sidebar panel
  // (which triggers/labels it) and FieldMap (which renders it). Lives
  // here rather than in the store since it's pure UI state, not session
  // data: drawing, GPS-walk capture, edge corrections, crop-row tapping.
  const [drawTarget, setDrawTarget] = useState<DrawTarget>(null)
  const [liveWalkPath, setLiveWalkPath] = useState<LatLng[]>([])
  const [correctionTarget, setCorrectionTarget] = useState<CorrectionTarget | null>(null)
  const [cropRowTapActive, setCropRowTapActive] = useState(false)
  const [simulateOverlay, setSimulateOverlay] = useState<SimulateOverlay | null>(null)

  const handleDrawFinish = (vertices: LatLng[]) => {
    if (drawTarget === 'boundary') {
      setBoundary(createBoundary(vertices, 'satellite-trace', { imageryDate: new Date().toISOString().slice(0, 10) }))
    } else if (drawTarget === 'zone') {
      addNoSprayZone({ id: `zone-${Date.now()}`, label: `Zone ${noSprayZones.length + 1}`, vertices })
    }
    setDrawTarget(null)
  }

  const handleCorrectionFinish = (trace: LatLng[], accuracyM: number) => {
    if (correctionTarget) walkEdge(correctionTarget.edgeId, trace, accuracyM)
    setCorrectionTarget(null)
  }

  const handleCropRowTap = (a: LatLng, b: LatLng) => {
    if (projection) {
      setSweepStrategy({ kind: 'crop-row', headingDeg: headingDegBetween(projection, a, b) })
    }
    setCropRowTapActive(false)
  }

  return (
    <AppShell>
      <div className="flex flex-1 min-h-0">
        <aside className="w-[380px] shrink-0 border-r border-(--border-subtle) bg-(--surface-app)">
          {currentStep === 'import' && (
            <ImportPanel
              drawTarget={drawTarget}
              onStartDrawBoundary={() => setDrawTarget('boundary')}
              onStartDrawZone={() => setDrawTarget('zone')}
              onCancelDraw={() => setDrawTarget(null)}
              onGpsWalkPointsChange={setLiveWalkPath}
            />
          )}
          {currentStep === 'verify' && (
            <VerifyPanel
              correctionTarget={correctionTarget}
              onStartWalkStrip={(edgeId) => setCorrectionTarget({ mode: 'walk-strip', edgeId })}
              onStartTrimEdge={(edgeId) => setCorrectionTarget({ mode: 'trim-edge', edgeId })}
              onCancelCorrection={() => setCorrectionTarget(null)}
            />
          )}
          {currentStep === 'plan' && (
            <PlanPanel cropRowTapActive={cropRowTapActive} onStartCropRowTap={() => setCropRowTapActive(true)} onCancelCropRowTap={() => setCropRowTapActive(false)} />
          )}
          {currentStep === 'simulate' && <SimulatePanel onOverlayChange={setSimulateOverlay} />}
          {currentStep === 'export' && <ExportPanel />}
          {currentStep === 'send' && <SendPanel />}
        </aside>

        <div className="flex-1 min-w-0">
          <FieldMap
            boundary={currentStep === 'simulate' ? null : boundary}
            noSprayZones={noSprayZones}
            sprayPlan={currentStep === 'simulate' ? null : sprayPlan}
            projection={projection}
            selectedEdgeId={selectedEdgeId}
            onSelectEdge={setSelectedEdgeId}
            showEdges={currentStep === 'verify'}
            showZones={currentStep !== 'send' && currentStep !== 'simulate'}
            showPlan={currentStep === 'plan' || currentStep === 'export' || currentStep === 'send'}
            drawTarget={drawTarget}
            onDrawFinish={handleDrawFinish}
            onDrawCancel={() => setDrawTarget(null)}
            liveWalkPath={liveWalkPath}
            correctionTarget={correctionTarget}
            onCorrectionFinish={handleCorrectionFinish}
            onCorrectionCancel={() => setCorrectionTarget(null)}
            cropRowTapActive={cropRowTapActive}
            onCropRowTap={handleCropRowTap}
            simulateOverlay={simulateOverlay}
          />
        </div>
      </div>
    </AppShell>
  )
}

export default App
