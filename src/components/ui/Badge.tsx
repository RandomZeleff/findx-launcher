interface BadgeProps {
  children: React.ReactNode
  color?: 'default' | 'accent' | 'success' | 'warning'
  className?: string
}

export function Badge({ children, color = 'default', className = '' }: BadgeProps) {
  const colors = {
    default: 'bg-elevated text-muted',
    accent:  'bg-[var(--color-accent-dim)] text-accent',
    success: 'bg-[#1e3a1e] text-success',
    warning: 'bg-[#3a2e00] text-warning',
  }

  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-sm font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  )
}
