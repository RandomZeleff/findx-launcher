import { Pause, Play, X, CheckCircle, AlertCircle, FolderOpen, Loader, Archive, AlertTriangle } from 'lucide-react'
import { useApp, type TorrentEntry } from '../../context/AppContext'
import { getBoolPref, PREF_AUTO_SHORTCUT } from '../../lib/preferences'
import { TorrentSwarmInfo } from '../torrent/TorrentSwarmInfo'
import { formatBitrate } from '../../lib/formatBitrate'

export function DownloadQueue() {
  const { state } = useApp()
  const visible = state.downloads.slice(0, 8)

  if (visible.length === 0) return null

  return (
    <div className="shadow-[0_-1px_0_var(--hairline)] bg-[var(--color-bg-surface)]">
      <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider shadow-[0_1px_0_var(--hairline)]">
        Téléchargements
      </div>
      <div className="max-h-48 overflow-y-auto">
        {visible.map(entry => (
          <DownloadRow key={entry.infoHash} entry={entry} />
        ))}
      </div>
    </div>
  )
}

export function DownloadRow({ entry }: { entry: TorrentEntry }) {
  const { dispatch } = useApp()

  async function handlePause() {
    try {
      const r = await window.electron.torrent.pause(entry.infoHash)
      if (r.ok) dispatch({ type: 'UPDATE_TORRENT', payload: { infoHash: entry.infoHash, status: 'paused' } })
    } catch {
      /* IPC */
    }
  }

  async function handleResume() {
    try {
      const r = await window.electron.torrent.resume(entry.infoHash)
      if (r.ok) dispatch({ type: 'UPDATE_TORRENT', payload: { infoHash: entry.infoHash, status: 'downloading' } })
    } catch {
      /* IPC */
    }
  }

  async function handleExtract() {
    let dest = entry.savePath
    if (!dest) {
      dest = await window.electron.selectInstallFolder()
      if (!dest) return
    }
    try {
      await window.electron.install.extract(entry.infoHash, dest, entry.gameTitle, getBoolPref(PREF_AUTO_SHORTCUT, true))
    } catch {
      /* errors come back via torrent:error event */
    }
  }

  async function handleRemove() {
    try {
      await window.electron.torrent.remove(entry.infoHash)
    } catch {
      /* déjà retiré côté moteur, on nettoie quand même l’UI */
    } finally {
      dispatch({ type: 'REMOVE_TORRENT', payload: entry.infoHash })
    }
  }

  const progressPct = Math.round(entry.progress * 100)

  return (
    <div className="px-4 py-2.5 shadow-[0_1px_0_var(--hairline)] last:shadow-none">
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <div className="shrink-0">
          {entry.status === 'done'        && <CheckCircle size={14} className="text-success" />}
          {entry.status === 'failed'      && <AlertCircle size={14} className="text-error" />}
          {entry.status === 'stalled'     && <AlertTriangle size={14} className="text-warning" />}
          {entry.status === 'connecting'  && <Loader size={14} className="text-muted animate-spin" />}
          {entry.status === 'downloading' && <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
          {entry.status === 'paused'      && <div className="w-2 h-2 rounded-full bg-warning" />}
          {entry.status === 'extracting'  && <Archive size={14} className="text-accent animate-pulse" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-primary truncate">{entry.gameTitle}</div>

          {/* Progress bar */}
          {entry.status !== 'done' && entry.status !== 'failed' && entry.status !== 'stalled' && entry.status !== 'extracting' && (
            <div className="mt-1 h-1 bg-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Speed / size / ETA / réseau (même ligne) */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            {entry.status === 'downloading' && (
              <span className="tabular-nums">{formatBitrate(entry.downloadSpeed)}</span>
            )}
            {entry.status === 'downloading' && entry.length > 0 && (
              <span className="tabular-nums">{formatBytes(entry.downloaded)} / {formatBytes(entry.length)}</span>
            )}
            {entry.status === 'downloading' && Number.isFinite(entry.timeRemaining) && entry.timeRemaining > 0 && (
              <span className="tabular-nums">{formatEta(entry.timeRemaining)}</span>
            )}
            {entry.status === 'done'       && <span className="text-success">Terminé</span>}
            {entry.status === 'extracting' && <span className="text-accent">Extraction en cours…</span>}
            {entry.status === 'stalled'    && <span className="text-warning truncate min-w-0 max-w-full" title={entry.error ?? undefined}>{entry.error || 'Aucun seeder disponible'}</span>}
            {entry.status === 'failed'     && <span className="text-error truncate">{entry.error || 'Erreur'}</span>}
            {(entry.status === 'connecting' || entry.status === 'downloading' || entry.status === 'stalled' || entry.status === 'paused') && (
              <TorrentSwarmInfo entry={entry} variant="inline" />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {entry.status === 'done' && entry.savePath && (
            <button
              onClick={() => window.electron.openPath(entry.savePath!)}
              className="p-1 text-muted hover:text-accent transition-colors"
              title="Ouvrir le dossier"
            >
              <FolderOpen size={13} />
            </button>
          )}
          {(entry.status === 'done' || entry.status === 'failed') && (
            <button
              onClick={handleExtract}
              className="p-1 text-muted hover:text-accent transition-colors"
              title="Ré-extraire les archives"
            >
              <Archive size={13} />
            </button>
          )}
          {entry.status === 'downloading' && (
            <button onClick={handlePause} className="p-1 text-muted hover:text-primary transition-colors">
              <Pause size={13} />
            </button>
          )}
          {(entry.status === 'paused' || entry.status === 'stalled') && (
            <button onClick={handleResume} className="p-1 text-muted hover:text-primary transition-colors" title="Continuer en arrière-plan">
              <Play size={13} />
            </button>
          )}
          {entry.status !== 'done' && entry.status !== 'extracting' && (
            <button onClick={handleRemove} className="p-1 text-muted hover:text-error transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes > 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes > 1_000_000)     return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes > 1_000)         return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

function formatEta(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}min`
  return `${Math.floor(s / 3600)}h`
}
