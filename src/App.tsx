import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { FieldMap, type DrawTarget } from '@/components/map/FieldMap'
import { ImportPanel } from '@/components/panels/ImportPanel'
import { PanelPlaceholder } from '@/components/panels/PanelPlaceholder'
import { PlanPanel } from '@/components/panels/PlanPanel'
import { VerifyPanel } from '@/components/panels/VerifyPanel'
import { createBoundary } from '@/lib/geo/boundary'
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

  // Transient draw/GPS-walk UI state — shared between the Import panel
  // (which triggers/labels it) and FieldMap (which renders it). Lives
  // here rather than in the store since it's pure interaction state, not
  // session data.
  const [drawTarget, setDrawTarget] = useState<DrawTarget>(null)
  const [liveWalkPath, setLiveWalkPath] = useState<LatLng[]>([])

  const handleDrawFinish = (vertices: LatLng[]) => {
    if (drawTarget === 'boundary') {
      setBoundary(createBoundary(vertices, 'satellite-trace', { imageryDate: new Date().toISOString().slice(0, 10) }))
    } else if (drawTarget === 'zone') {
      addNoSprayZone({ id: `zone-${Date.now()}`, label: `Zone ${noSprayZones.length + 1}`, vertices })
    }
    setDrawTarget(null)
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
          {currentStep === 'verify' && <VerifyPanel />}
          {currentStep === 'plan' && <PlanPanel />}
          {currentStep === 'simulate' && (
            <PanelPlaceholder
              title="Simulate"
              description="Blind vs. Sighted replay against hidden ground truth — coverage, overspray, litres, cost."
              nextUp="Replay/simulator"
            />
          )}
          {currentStep === 'send' && (
            <PanelPlaceholder
              title="Send to vehicle"
              description="Export mission files, or upload live to a connected Pixhawk over Web Serial."
              nextUp="VehicleLink + WebSerialVehicle, exports"
            />
          )}
        </aside>

        <div className="flex-1 min-w-0">
          <FieldMap
            boundary={boundary}
            noSprayZones={noSprayZones}
            sprayPlan={sprayPlan}
            projection={projection}
            selectedEdgeId={selectedEdgeId}
            onSelectEdge={setSelectedEdgeId}
            showEdges={currentStep === 'verify'}
            showZones={currentStep !== 'send'}
            showPlan={currentStep === 'plan' || currentStep === 'simulate' || currentStep === 'send'}
            drawTarget={drawTarget}
            onDrawFinish={handleDrawFinish}
            onDrawCancel={() => setDrawTarget(null)}
            liveWalkPath={liveWalkPath}
          />
        </div>
      </div>
    </AppShell>
  )
}

export default App
