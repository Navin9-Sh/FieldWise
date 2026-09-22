import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { sprayPlanToWaypoints } from '@/lib/vehicle/missionFromPlan'
import type { ConnectionState, MissionUploadResult, VehicleTelemetry } from '@/lib/vehicle/types'
import { EMPTY_TELEMETRY } from '@/lib/vehicle/types'
import { WebSerialVehicle } from '@/lib/vehicle/webSerialVehicle'
import { useFieldStore } from '@/store/useFieldStore'

const STATE_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Connection failed',
}
const STATE_CLASSES: Record<ConnectionState, string> = {
  disconnected: 'bg-(--surface-panel-raised) text-(--text-muted)',
  connecting: 'bg-provenance-walked-bg text-provenance-walked',
  connected: 'bg-success-bg text-success',
  error: 'bg-danger-bg text-danger',
}

function webSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

/** A minimal artificial-horizon indicator — rotates with roll, shifts with pitch. Real MAVLink ATTITUDE data, not simulated. */
function AttitudeIndicator({ rollDeg, pitchDeg }: { rollDeg: number; pitchDeg: number }) {
  const clampedPitch = Math.max(-30, Math.min(30, pitchDeg))
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-(--border-subtle) bg-ink-200">
      <div
        className="absolute inset-[-50%]"
        style={{ transform: `rotate(${-rollDeg}deg) translateY(${clampedPitch * 1.2}px)` }}
      >
        <div className="absolute inset-0 top-1/2 bg-brand-600" />
        <div className="absolute inset-0 bottom-1/2 bg-sky-300" style={{ background: '#bfe3fb' }} />
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/70" />
      </div>
      <div className="absolute left-1/2 top-1/2 h-2 w-8 -translate-x-1/2 -translate-y-1/2 border-y-2 border-white" />
    </div>
  )
}

export function SendPanel() {
  const boundary = useFieldStore((s) => s.boundary)
  const sprayPlan = useFieldStore((s) => s.sprayPlan)
  const projection = useFieldStore((s) => s.projection)
  const droneProfile = useFieldStore((s) => s.droneProfile)

  const [vehicle] = useState(() => new WebSerialVehicle())
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [telemetry, setTelemetry] = useState<VehicleTelemetry>(EMPTY_TELEMETRY)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<MissionUploadResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    const offTelemetry = vehicle.onTelemetry(setTelemetry)
    const offState = vehicle.onConnectionStateChange(setConnectionState)
    const offLog = vehicle.onLog((msg) => setLogLines((prev) => [...prev.slice(-19), msg]))
    return () => {
      offTelemetry()
      offState()
      offLog()
      void vehicle.disconnect() // don't leave a serial port open if the pilot navigates away from this step
    }
  }, [vehicle])

  if (!boundary || !sprayPlan) {
    return <div className="p-4 text-sm text-(--text-secondary)">No plan yet — go back to Plan.</div>
  }

  const handleConnect = async () => {
    setConnectError(null)
    try {
      await vehicle.connect()
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect.')
    }
  }

  const handleUpload = async () => {
    if (!projection) return
    setUploading(true)
    setUploadError(null)
    setUploadResult(null)
    try {
      const waypoints = sprayPlanToWaypoints(sprayPlan, projection, droneProfile.altitudeM)
      const result = await vehicle.uploadAndVerifyMission(waypoints)
      setUploadResult(result)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Mission upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="text-sm font-semibold text-(--text-primary)">Send to vehicle</h2>
        <p className="mt-1 text-xs text-(--text-secondary)">
          Pixhawk over USB via Web Serial — Chrome or Edge only. This link is unverified against real hardware; see
          the connection checklist.
        </p>
      </div>

      {!webSerialSupported() && (
        <div className="rounded-(--radius-card) border border-warning/30 bg-warning-bg p-3 text-xs text-warning">
          Web Serial isn't available in this browser. Open this page in Chrome or Edge to connect a Pixhawk.
        </div>
      )}

      <div className="flex items-center justify-between rounded-(--radius-card) border border-(--border-subtle) bg-(--surface-panel) p-3">
        <span className={clsx('rounded-full px-2.5 py-1 text-xs font-medium', STATE_CLASSES[connectionState])}>
          {STATE_LABEL[connectionState]}
        </span>
        {connectionState === 'connected' ? (
          <Button size="sm" variant="secondary" onClick={() => void vehicle.disconnect()}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" variant="primary" disabled={!webSerialSupported() || connectionState === 'connecting'} onClick={handleConnect}>
            Connect Pixhawk
          </Button>
        )}
      </div>
      {connectError && <p className="text-xs text-danger">{connectError}</p>}

      {connectionState === 'connected' && (
        <section className="space-y-2 rounded-(--radius-card) border border-(--border-subtle) bg-(--surface-panel) p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Live telemetry</h3>
          <div className="flex items-center gap-3">
            {telemetry.attitude ? (
              <AttitudeIndicator rollDeg={telemetry.attitude.rollDeg} pitchDeg={telemetry.attitude.pitchDeg} />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-(--border-subtle) text-[10px] text-(--text-muted)">
                no attitude
              </div>
            )}
            <div className="grid flex-1 grid-cols-2 gap-2">
              <StatCard
                label="GPS fix"
                value={telemetry.gps.fixType}
                hint={telemetry.gps.satellites !== null ? `${telemetry.gps.satellites} sats` : undefined}
              />
              <StatCard label="HDOP" value={telemetry.gps.hdop !== null ? telemetry.gps.hdop.toFixed(1) : '—'} />
              {telemetry.attitude && (
                <>
                  <StatCard label="Roll" value={telemetry.attitude.rollDeg.toFixed(0)} unit="°" />
                  <StatCard label="Pitch" value={telemetry.attitude.pitchDeg.toFixed(0)} unit="°" />
                </>
              )}
            </div>
          </div>
          {telemetry.gps.position && (
            <div className="text-xs text-(--text-secondary)">
              {telemetry.gps.position.lat.toFixed(6)}, {telemetry.gps.position.lon.toFixed(6)}
            </div>
          )}
          <div className="text-[11px] text-(--text-muted)">
            {telemetry.heartbeatOk ? 'Heartbeat OK' : 'No recent heartbeat'}
            {telemetry.heartbeatAgeMs !== null && ` · ${Math.round(telemetry.heartbeatAgeMs / 1000)}s ago`}
          </div>
        </section>
      )}

      <div className="h-px bg-(--border-subtle)" />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Upload mission</h3>
        <p className="text-xs text-(--text-secondary)">
          Sends the current plan's {sprayPlan.sorties.reduce((s, sortie) => s + sortie.passes.length, 0)} legs as
          waypoints, then downloads them back to verify the upload took.
        </p>
        <Button variant="primary" disabled={connectionState !== 'connected' || uploading} onClick={handleUpload}>
          {uploading ? 'Uploading…' : 'Upload mission'}
        </Button>

        {uploadError && <p className="text-xs text-danger">{uploadError}</p>}

        {uploadResult && (
          <div
            className={clsx(
              'rounded-(--radius-card) border p-3 text-sm',
              uploadResult.verified ? 'border-success/30 bg-success-bg text-success' : 'border-danger/30 bg-danger-bg text-danger',
            )}
          >
            {uploadResult.verified
              ? `Verified — ${uploadResult.uploadedCount}/${uploadResult.uploadedCount} waypoints read back match.`
              : `${uploadResult.mismatches.length} mismatch(es) — ${uploadResult.mismatches[0]?.reason ?? ''}`}
          </div>
        )}
      </section>

      <div className="h-px bg-(--border-subtle)" />

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Log</h3>
        <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-(--radius-control) bg-ink-900 p-2 font-mono text-[10px] text-ink-100">
          {logLines.length === 0 ? <div className="text-ink-500">—</div> : logLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </section>
    </div>
  )
}
