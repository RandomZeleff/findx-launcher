import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { DownloadRow } from '../download/DownloadBar'
import { formatBitrate } from '../../lib/formatBitrate'

export function StatusBar() {
  const { state } = useApp()
  const [open, setOpen] = useState(false)

  const active      = state.downloads.filter(d => d.status !== 'done')
  const downloading = state.downloads.filter(d => d.status === 'downloading')
  const totalDlSpeed = downloading.reduce((acc, d) => acc + d.downloadSpeed, 0)

  const seeds         = state.seeds
  const totalUpload   = seeds.reduce((acc, s) => acc + s.uploadSpeed, 0)
  const totalPeers    = seeds.reduce((acc, s) => acc + s.numPeers, 0)

  // Referme automatiquement quand il n'y a plus rien en cours
  useEffect(() => {
    if (active.length === 0) setOpen(false)
  }, [active.length])

  return (
    <div className="shrink-0">

      {/* ── Panneau déployable ────────────────────────────────────────────── */}
      {open && (
        <div
          className="border-t overflow-y-auto"
          style={{
            maxHeight: '14rem',
            background: 'var(--color-bg-surface)',
            borderColor: 'var(--hairline-strong)',
          }}
        >
          {active.map(entry => (
            <DownloadRow key={entry.infoHash} entry={entry} />
          ))}
        </div>
      )}

      {/* ── Barre de statut ───────────────────────────────────────────────── */}
      <div
        className="h-7 flex items-center px-3 gap-4 text-xs text-[var(--color-text-muted)] shrink-0"
        style={{ background: 'var(--color-bg-surface)', borderTop: '1px solid var(--hairline)' }}
      >
        {/* Gauche: téléchargements (prioritaire) ou partage */}
        {active.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-[var(--color-accent)] hover:opacity-80 transition-opacity app-no-drag"
          >
            <ChevronUp
              size={13}
              className="shrink-0 transition-transform duration-150"
              style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)' }}
            />
            {downloading.length > 0
              ? `↓ ${formatBitrate(totalDlSpeed)} · ${active.length} en cours`
              : `${active.length} téléchargement${active.length > 1 ? 's' : ''}`
            }
          </button>
        ) : seeds.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
            <span style={{ color: 'var(--color-accent)' }}>
              {seeds.length} jeu{seeds.length > 1 ? 'x' : ''} partagé{seeds.length > 1 ? 's' : ''}
              {totalUpload > 0 && ` · ↑ ${formatBitrate(totalUpload)}`}
              {` · ${totalPeers} pair${totalPeers > 1 ? 's' : ''}`}
            </span>
          </div>
        ) : (
          <span>Aucun téléchargement actif</span>
        )}

        {/* Indicateurs à droite */}
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${state.steamRunning ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`} />
            <span>Steam {state.steamRunning ? 'ouvert' : 'fermé'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${state.apiConnected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'}`} />
            <span>{state.apiConnected ? 'API connectée' : 'API hors ligne'}</span>
          </div>
        </div>
      </div>

    </div>
  )
}

