interface StatCardProps {
  label: string
  value: string
  unit?: string
  hint?: string
}

/** A single labeled stat tile — sorties, litres, minutes, area, etc. Deliberately plain (no charting): these are headline numbers, not a trend to visualize. */
export function StatCard({ label, value, unit, hint }: StatCardProps) {
  return (
    <div className="rounded-(--radius-card) border border-(--border-subtle) bg-(--surface-panel) p-4">
      <div className="text-xs font-medium text-(--text-muted)">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-(--text-primary)">{value}</span>
        {unit && <span className="text-sm text-(--text-secondary)">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-(--text-muted)">{hint}</div>}
    </div>
  )
}
