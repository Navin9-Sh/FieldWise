import { AppShell } from '@/components/layout/AppShell'
import { PanelPlaceholder } from '@/components/panels/PanelPlaceholder'
import { useFieldStore } from '@/store/useFieldStore'

function App() {
  const currentStep = useFieldStore((s) => s.currentStep)

  return (
    <AppShell>
      {currentStep === 'import' && (
        <PanelPlaceholder
          title="Import field boundary"
          description="Trace on satellite imagery, walk it with GPS, or import KML/GeoJSON."
          nextUp="Map UI (satellite tiles, draw/import, sample field)"
        />
      )}
      {currentStep === 'verify' && (
        <PanelPlaceholder
          title="Verify boundary"
          description="Edge-by-edge provenance: satellite / walked / confirmed. Field-Truth Walk corrections happen here."
          nextUp="Correction flow (edge provenance, walk-a-strip, calibration tap)"
        />
      )}
      {currentStep === 'plan' && (
        <PanelPlaceholder
          title="Plan spray path"
          description="Boustrophedon sweep, no-spray zones, drone profile, tank-aware sorties."
          nextUp="Geometry core (planner, no-spray clipping, sortie splitting)"
        />
      )}
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
    </AppShell>
  )
}

export default App
