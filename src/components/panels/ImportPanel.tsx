import { useRef, useState } from 'react'
import type { DrawTarget } from '@/components/map/FieldMap'
import { GpsWalkCapture } from '@/components/panels/GpsWalkCapture'
import { LocationSearch, type SelectedLocation } from '@/components/panels/LocationSearch'
import { Button } from '@/components/ui/Button'
import { createBoundary } from '@/lib/geo/boundary'
import { BoundaryImportError, parseBoundaryFile } from '@/lib/geo/importFormats'
import type { LatLng } from '@/lib/geo/types'
import { useFieldStore } from '@/store/useFieldStore'

interface ImportPanelProps {
  drawTarget: DrawTarget
  onStartDrawBoundary: () => void
  onStartDrawZone: () => void
  onCancelDraw: () => void
  onGpsWalkPointsChange: (points: LatLng[]) => void
  onLocationSelected: (location: SelectedLocation) => void
}

export function ImportPanel({
  drawTarget,
  onStartDrawBoundary,
  onStartDrawZone,
  onCancelDraw,
  onGpsWalkPointsChange,
  onLocationSelected,
}: ImportPanelProps) {
  const boundary = useFieldStore((s) => s.boundary)
  const noSprayZones = useFieldStore((s) => s.noSprayZones)
  const sprayPlan = useFieldStore((s) => s.sprayPlan)
  const readiness = useFieldStore((s) => s.readiness)
  const setBoundary = useFieldStore((s) => s.setBoundary)
  const removeNoSprayZone = useFieldStore((s) => s.removeNoSprayZone)
  const loadSample = useFieldStore((s) => s.loadSample)
  const setStep = useFieldStore((s) => s.setStep)

  const [gpsWalkOpen, setGpsWalkOpen] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setFileError(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result)
        const vertices = parseBoundaryFile(file.name, text)
        const source = file.name.toLowerCase().endsWith('.kml') ? 'kml-import' : 'geojson-import'
        setBoundary(createBoundary(vertices, source))
      } catch (err) {
        setFileError(err instanceof BoundaryImportError ? err.message : 'Could not read this file.')
      }
    }
    reader.onerror = () => setFileError('Could not read this file.')
    reader.readAsText(file)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="text-sm font-semibold text-(--text-primary)">Import field boundary</h2>
        <p className="mt-1 text-xs text-(--text-secondary)">
          Every input mode below produces the same starting point: a dated, unverified prior. Nothing is trusted
          until it's verified in the next step.
        </p>
      </div>

      <LocationSearch onLocationSelected={onLocationSelected} />

      <div className="h-px bg-(--border-subtle)" />

      <Button variant="primary" onClick={loadSample}>
        Load sample field
      </Button>

      <div className="h-px bg-(--border-subtle)" />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Trace on satellite</h3>
        {drawTarget === 'boundary' ? (
          <Button size="sm" variant="secondary" onClick={onCancelDraw}>
            Cancel drawing
          </Button>
        ) : (
          <Button size="sm" variant="secondary" disabled={drawTarget !== null} onClick={onStartDrawBoundary}>
            Draw boundary on map
          </Button>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">GPS walk</h3>
        {gpsWalkOpen ? (
          <GpsWalkCapture
            onComplete={(vertices) => {
              setBoundary(createBoundary(vertices, 'gps-walk'))
              setGpsWalkOpen(false)
              onGpsWalkPointsChange([])
            }}
            onCancel={() => {
              setGpsWalkOpen(false)
              onGpsWalkPointsChange([])
            }}
            onPointsChange={onGpsWalkPointsChange}
          />
        ) : (
          <Button size="sm" variant="secondary" disabled={drawTarget !== null} onClick={() => setGpsWalkOpen(true)}>
            Walk the boundary
          </Button>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Import file</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json,.kml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import .geojson / .kml
        </Button>
        {fileError && <p className="text-xs text-danger">{fileError}</p>}
      </section>

      {boundary && (
        <>
          <div className="h-px bg-(--border-subtle)" />

          <section className="space-y-2 rounded-(--radius-card) border border-(--border-subtle) bg-(--surface-panel) p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Current field</h3>
              <span className="text-xs text-(--text-muted)">{boundary.vertices.length} vertices</span>
            </div>
            <div className="text-sm text-(--text-primary)">{sprayPlan ? `${sprayPlan.areaHa.toFixed(2)} ha sprayable` : '—'}</div>
            {readiness && (
              <div className="text-xs text-(--text-secondary)">
                {readiness.cleared ? 'All edges verified' : `${readiness.unverifiedEdges} of ${readiness.totalEdges} edges unverified`}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">No-spray zones</h3>
              {drawTarget === 'zone' ? (
                <Button size="sm" variant="ghost" onClick={onCancelDraw}>
                  Cancel
                </Button>
              ) : (
                <Button size="sm" variant="ghost" disabled={drawTarget !== null} onClick={onStartDrawZone}>
                  + Draw zone
                </Button>
              )}
            </div>
            {noSprayZones.length === 0 ? (
              <p className="text-xs text-(--text-muted)">None yet — obstacles, ponds, or exclusion lanes.</p>
            ) : (
              <ul className="space-y-1">
                {noSprayZones.map((zone) => (
                  <li
                    key={zone.id}
                    className="flex items-center justify-between rounded-(--radius-control) border border-(--border-subtle) px-2.5 py-1.5 text-sm"
                  >
                    <span>{zone.label}</span>
                    <button
                      type="button"
                      className="text-xs text-danger hover:underline"
                      onClick={() => removeNoSprayZone(zone.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-auto pt-2">
            <Button variant="primary" className="w-full" onClick={() => setStep('verify')}>
              Continue to Verify
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
