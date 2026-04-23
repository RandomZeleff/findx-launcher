import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Download, RefreshCw, Sparkles } from 'lucide-react'

type UpdatePhase = 'hidden' | 'available' | 'progress' | 'ready'

type UpdatePayload =
  | { type: 'available'; version?: string }
  | { type: 'progress'; percent?: number }
  | { type: 'ready'; version?: string }
  | { type: 'error'; message?: string }

/**
 * CTA mises à jour (electron-updater) : affiché uniquement sur annonce côté main.
 * Bordure / pied de barre latérale : uniquement lorsque du contenu est affiché.
 */
export function UpdatePromo() {
  const [phase, setPhase] = useState<UpdatePhase>('hidden')
  const [version, setVersion] = useState('')
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    if (!window.electron?.app?.onUpdate) return

    return window.electron.app.onUpdate(raw => {
      if (raw.type === 'error') return
      const p = raw as UpdatePayload
      if (p.type === 'available') {
        setPhase('available')
        setVersion(p.version ?? '')
        return
      }
      if (p.type === 'progress') {
        setPhase('progress')
        setPercent(typeof p.percent === 'number' ? Math.round(p.percent) : 0)
        return
      }
      if (p.type === 'ready') {
        setPhase('ready')
        setVersion(p.version ?? '')
      }
    })
  }, [])

  const install = useCallback(() => {
    void window.electron?.app?.installUpdate?.()
  }, [])

  if (phase === 'hidden') return null

  let inner: ReactNode
  if (phase === 'ready') {
    inner = (
      <button
        type="button"
        onClick={install}
        className="app-no-drag w-full flex items-center justify-center gap-2 rounded-lg px-2.5 py-2.5 text-[11px] font-semibold leading-snug
                   text-[#0d1f14] bg-gradient-to-b from-emerald-400 to-emerald-600
                   ring-1 ring-emerald-300/50 shadow-[0_0_20px_rgba(52,211,153,0.2)]
                   hover:from-emerald-300 hover:to-emerald-500 transition-colors text-center
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
      >
        <RefreshCw size={15} className="shrink-0" strokeWidth={2.5} aria-hidden />
        <span className="min-w-0">Redémarrer pour installer v{version}</span>
      </button>
    )
  } else if (phase === 'progress') {
    inner = (
      <div
        className="app-no-drag w-full flex flex-col gap-2 rounded-lg px-2.5 py-2.5 text-xs font-medium
                   text-primary bg-elevated/50 ring-1 ring-white/[0.08]"
      >
        <div className="flex items-center gap-2">
          <Download size={14} className="shrink-0 text-emerald-400 animate-pulse" aria-hidden />
          <span className="tabular-nums text-[11px] text-muted">{percent} %</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-elevated overflow-hidden min-w-0">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width] duration-300"
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>
    )
  } else {
    inner = (
      <div
        className="app-no-drag w-full flex items-start gap-2 rounded-lg px-2.5 py-2.5 text-xs font-medium
                   text-primary bg-gradient-to-b from-surface/95 to-elevated/40
                   ring-1 ring-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.06)]"
      >
        <Sparkles size={15} className="shrink-0 text-emerald-400 mt-0.5" aria-hidden />
        <p className="text-[11px] leading-snug min-w-0">
          <span className="font-semibold text-white/95">Mise à jour disponible</span>
          {version ? (
            <span className="block mt-0.5 text-[10px] text-muted font-mono tabular-nums">v{version}</span>
          ) : null}
        </p>
      </div>
    )
  }

  return (
    <div className="app-no-drag mt-auto shrink-0 w-full min-w-0 border-t border-white/[0.08] p-2.5">
      {inner}
    </div>
  )
}
