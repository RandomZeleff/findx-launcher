import { type SelectHTMLAttributes } from 'react'

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`bg-surface ring-1 ring-white/[0.06] rounded text-primary
                  text-sm px-3 py-2 focus:outline-none focus:ring-accent/35 transition-[box-shadow] ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}
