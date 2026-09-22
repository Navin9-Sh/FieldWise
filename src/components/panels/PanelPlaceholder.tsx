interface PanelPlaceholderProps {
  title: string
  description: string
  nextUp: string
}

/**
 * Scaffold-stage stand-in for each workflow step's real panel. Each one is
 * replaced in its own pass (map UI, verify/correction flow, planner,
 * simulator, vehicle link) — kept as a single component so it's obvious
 * at a glance which panels are still stubs.
 */
export function PanelPlaceholder({ title, description, nextUp }: PanelPlaceholderProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-(--radius-card) border border-dashed border-(--border-subtle) bg-(--surface-panel) p-8 text-center shadow-(--shadow-panel)">
        <h2 className="text-lg font-semibold text-(--text-primary)">{title}</h2>
        <p className="mt-2 text-sm text-(--text-secondary)">{description}</p>
        <p className="mt-4 text-xs font-medium text-(--text-muted)">Next up: {nextUp}</p>
      </div>
    </div>
  )
}
