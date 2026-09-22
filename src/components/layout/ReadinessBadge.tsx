import clsx from 'clsx'
import type { ReadinessSummary } from '@/lib/geo/types'

interface ReadinessBadgeProps {
  readiness: ReadinessSummary | null
}

/**
 * The Flight Readiness Gate, always visible — this is the visible
 * enforcement of "never trust the satellite input blindly". It reads a
 * precomputed summary rather than boundary data directly; the actual
 * gating logic lives in lib/geo/readiness.ts.
 */
export function ReadinessBadge({ readiness }: ReadinessBadgeProps) {
  if (!readiness) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-(--border-subtle) bg-(--surface-panel) px-3 py-1.5 text-sm text-(--text-muted)">
        <span className="h-2 w-2 rounded-full bg-ink-300" />
        No field loaded
      </div>
    )
  }

  if (readiness.cleared) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-success/20 bg-success-bg px-3 py-1.5 text-sm font-medium text-success">
        <span className="h-2 w-2 rounded-full bg-success" />
        Cleared for flight
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-full border border-warning/20 bg-warning-bg px-3 py-1.5 text-sm font-medium text-warning',
      )}
    >
      <span className="h-2 w-2 rounded-full bg-warning" />
      {readiness.unverifiedEdges} unverified edge{readiness.unverifiedEdges === 1 ? '' : 's'} ·{' '}
      {Math.round(readiness.unverifiedLengthM)} m
    </div>
  )
}
