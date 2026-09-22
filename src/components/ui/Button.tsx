import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-ink-200 disabled:text-ink-400',
  secondary:
    'bg-(--surface-panel) text-(--text-primary) border border-(--border-subtle) hover:bg-(--surface-panel-raised) disabled:text-(--text-muted)',
  ghost: 'text-(--text-secondary) hover:bg-(--surface-panel-raised) disabled:text-(--text-muted)',
  danger: 'bg-danger-bg text-danger hover:bg-danger/20 disabled:text-(--text-muted) disabled:bg-transparent',
}

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-(--radius-control) font-medium transition-colors disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  )
}
