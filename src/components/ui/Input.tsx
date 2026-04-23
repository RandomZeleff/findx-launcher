import { type InputHTMLAttributes } from 'react'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`bg-surface ring-1 ring-white/[0.06] rounded text-primary placeholder:text-muted
                  text-sm px-3 py-2 focus:outline-none focus:ring-accent/35 transition-[box-shadow] w-full ${className}`}
      {...props}
    />
  )
}
