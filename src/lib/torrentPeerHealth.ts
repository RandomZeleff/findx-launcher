import type { TorrentEntry } from '../context/AppContext'

export type TorrentPeerHealth = 'good' | 'warn' | 'bad' | 'unknown'

/** Seuils indicatifs : au-delà de 4 pairs, le swarm est considéré comme sain. */
export function getTorrentPeerHealth(
  numPeers: number | undefined,
  status: TorrentEntry['status'],
): TorrentPeerHealth {
  if (status === 'paused') return 'unknown'
  if (status === 'extracting' || status === 'done' || status === 'failed') return 'unknown'

  if (numPeers === undefined) {
    if (status === 'connecting') return 'unknown'
    return 'warn'
  }
  if (numPeers <= 0) return 'bad'
  if (numPeers < 5) return 'warn'
  return 'good'
}

export function torrentSwarmHint(
  health: TorrentPeerHealth,
  status: TorrentEntry['status'],
): string | null {
  if (status === 'paused' || status === 'extracting' || status === 'done' || status === 'failed') {
    return null
  }
  switch (health) {
    case 'good':
      return null
    case 'warn':
      return 'Peu de pairs — le téléchargement peut être lent. Les débits augmentent souvent lorsque d’autres joueurs rejoignent le réseau.'
    case 'bad':
      return 'Quasiment aucun pair — le téléchargement risque d’être très lent ou impossible. Nous vous conseillons de réessayer plus tard.'
    case 'unknown':
      return 'Recherche de pairs sur le réseau BitTorrent…'
    default:
      return null
  }
}

export function peerHealthColorCss(health: TorrentPeerHealth): string {
  switch (health) {
    case 'good':
      return 'var(--color-success)'
    case 'warn':
      return '#ca8a04'
    case 'bad':
      return 'var(--color-error)'
    default:
      return 'var(--color-text-muted)'
  }
}
