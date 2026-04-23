import { Info, Wifi } from 'lucide-react'
import type { TorrentEntry } from '../../context/AppContext'
import { getTorrentPeerHealth, torrentSwarmHint, peerHealthColorCss } from '../../lib/torrentPeerHealth'

const swarmBox =
  'mt-3 pt-3 border-t border-[var(--hairline)] flex items-start gap-2 text-[11px] leading-snug'
const swarmBoxPaused =
  'mt-3 pt-3 border-t border-[var(--hairline)] flex items-center gap-2 text-[11px] text-muted'

type TorrentSwarmInfoProps = { entry: TorrentEntry; className?: string; variant?: 'default' | 'inline' }

export function TorrentSwarmInfo({ entry, className = '', variant = 'default' }: TorrentSwarmInfoProps) {
  if (entry.status === 'done' || entry.status === 'failed' || entry.status === 'extracting') return null

  const health = getTorrentPeerHealth(entry.numPeers, entry.status)
  const color = peerHealthColorCss(health)
  const hint = torrentSwarmHint(health, entry.status)

  if (entry.status === 'paused') {
    if (entry.numPeers === undefined) return null
    if (variant === 'inline') {
      return (
        <span
          className={`inline-flex items-center gap-1 text-[11px] text-muted min-w-0 ${className}`}
          title={`${entry.numPeers} pair${entry.numPeers > 1 ? 's' : ''} connecté${entry.numPeers > 1 ? 's' : ''} (en pause)`}
        >
          <Wifi size={11} className="shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden />
          <span className="whitespace-nowrap">
            {entry.numPeers} pair{entry.numPeers > 1 ? 's' : ''} (pause)
          </span>
        </span>
      )
    }
    return (
      <div className={`${swarmBoxPaused} ${className}`}>
        <Wifi size={12} className="shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden />
        <span>
          {entry.numPeers} pair{entry.numPeers > 1 ? 's' : ''} connecté{entry.numPeers > 1 ? 's' : ''} (en pause)
        </span>
      </div>
    )
  }

  const peerLabel =
    entry.numPeers !== undefined
      ? `${entry.numPeers} pair${entry.numPeers > 1 ? 's' : ''} connecté${entry.numPeers > 1 ? 's' : ''}`
      : 'Pairs…'

  const showHint = hint != null && health !== 'good'

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] ${className}`}
        title={hint ?? peerLabel}
      >
        <Wifi size={11} className="shrink-0 mt-px" style={{ color }} aria-hidden />
        <span className="min-w-0 truncate tabular-nums" style={{ color: health === 'good' ? 'var(--color-text-primary)' : color }}>
          {peerLabel}
        </span>
        {showHint && (
          <span
            className="inline-flex shrink-0 text-muted"
            title={hint ?? undefined}
            aria-label={hint ?? undefined}
          >
            <Info size={12} className="opacity-80" strokeWidth={2} />
          </span>
        )}
      </span>
    )
  }

  return (
    <div className={`${swarmBox} ${className}`}>
      <Wifi size={12} className="shrink-0 mt-px" style={{ color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div>
          <span style={{ color: 'var(--color-text-primary)' }}>{peerLabel}</span>
        </div>
        {showHint && <p className="text-muted mt-1">{hint}</p>}
      </div>
    </div>
  )
}
