import clsx from 'clsx'
import type { ProvenanceKind } from '@/lib/geo/types'

const LABELS: Record<ProvenanceKind, string> = {
  satellite: 'Satellite',
  walked: 'Walked',
  confirmed: 'Confirmed',
}

const CLASSES: Record<ProvenanceKind, string> = {
  satellite: 'bg-provenance-satellite-bg text-provenance-satellite border-provenance-satellite/30',
  walked: 'bg-provenance-walked-bg text-provenance-walked border-provenance-walked/30',
  confirmed: 'bg-provenance-confirmed-bg text-provenance-confirmed border-provenance-confirmed/30',
}

interface ProvenanceBadgeProps {
  kind: ProvenanceKind
  className?: string
}

/** The trust model's smallest visible unit — used in the edge list, and anywhere else a single edge's state needs to read at a glance. */
export function ProvenanceBadge({ kind, className }: ProvenanceBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        CLASSES[kind],
        className,
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          kind === 'satellite' && 'bg-provenance-satellite',
          kind === 'walked' && 'bg-provenance-walked',
          kind === 'confirmed' && 'bg-provenance-confirmed',
        )}
      />
      {LABELS[kind]}
    </span>
  )
}
