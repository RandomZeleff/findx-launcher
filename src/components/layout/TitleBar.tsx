import { Minus, Square, X } from 'lucide-react'
import { useAppVersion } from '../../lib/useAppVersion'

export function TitleBar() {
  const appVersion = useAppVersion()

  return (
    <div className="app-drag flex items-center justify-between h-8 bg-surface shadow-[0_1px_0_var(--hairline)] shrink-0 select-none min-w-0">
      <div className="px-4 flex items-baseline gap-2 min-w-0">
        <span className="text-accent font-bold tracking-widest text-sm uppercase">findx</span>
        {appVersion && (
          <span
            className="text-[10px] text-muted/90 font-mono tabular-nums tracking-tight"
            title={`Version ${appVersion}`}
          >
            v{appVersion}
          </span>
        )}
      </div>

      <div className="app-no-drag flex h-full">
        <button
          onClick={() => window.electron?.minimize()}
          className="w-12 h-full flex items-center justify-center text-muted hover:text-primary hover:bg-hover transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.electron?.maximize()}
          className="w-12 h-full flex items-center justify-center text-muted hover:text-primary hover:bg-hover transition-colors"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.electron?.close()}
          className="w-12 h-full flex items-center justify-center text-muted hover:text-white hover:bg-error transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
