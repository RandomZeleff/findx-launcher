import { useCallback, useState, type MouseEvent } from 'react'
import { Download, Eye, Library, Loader2, X } from 'lucide-react'
import type { Game } from '../../api/games'
import { proxyImageUrl } from '../../api/client'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../lib/categories'
import { useApp } from '../../context/AppContext'
import { Spinner } from '../ui/Spinner'

interface GameCardProps {
  game: Game
  onSelect: (game: Game) => void
  onDownload?: (game: Game) => void
  isDownloadStarting?: boolean
  onCancelDownloadStart?: () => void
}

export function GameCard({
  game,
  onSelect,
  onDownload,
  isDownloadStarting = false,
  onCancelDownloadStart,
}: GameCardProps) {
  const { state, dispatch } = useApp()
  const activeDownload = state.downloads.find(d => d.gameId === game.id)
  const showInstall = Boolean(activeDownload && activeDownload.status !== 'done')
  const isInstalled =
    state.installations.some(i => i.gameId === game.id) || activeDownload?.status === 'done'

  const label = game.category ? (CATEGORY_LABELS[game.category] || game.category) : null
  const color = game.category ? CATEGORY_COLORS[game.category] : undefined

  const canDownload = Boolean(game.hasTorrent)
  const isStarting = Boolean(
    isDownloadStarting && canDownload && onDownload && onCancelDownloadStart,
  )
  const views = game.views
  const [imgError, setImgError] = useState(false)

  const handleRemoveTorrent = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation()
      if (!activeDownload) return
      try {
        await window.electron.torrent.remove(activeDownload.infoHash)
      } catch {
        /* moteur déjà arrêté */
      } finally {
        dispatch({ type: 'REMOVE_TORRENT', payload: activeDownload.infoHash })
      }
    },
    [activeDownload, dispatch],
  )

  return (
    <div
      className="group relative rounded-lg overflow-hidden cursor-pointer select-none
                 ring-1 ring-white/[0.04] hover:ring-accent/30
                 transition-[box-shadow] duration-200"
      onClick={() => onSelect(game)}
    >
      <div className="relative aspect-[3/2] bg-[var(--color-bg-surface)] overflow-hidden isolate">
        {game.image_url && !imgError ? (
          <img
            src={proxyImageUrl(game.image_url)!}
            alt={game.title_clean}
            className="absolute inset-0 h-full w-full object-cover object-center origin-center
                       transition-[transform,filter] duration-[280ms] ease-out
                       group-hover:scale-[1.045] group-hover:brightness-105"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center px-3 bg-elevated">
            <span className="text-[11px] text-muted text-center leading-relaxed line-clamp-3">
              {game.title_clean}
            </span>
          </div>
        )}

        <div
          className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-base)] via-[var(--color-bg-base)]/25 to-transparent opacity-95 pointer-events-none"
          aria-hidden
        />

        {label && (
          <span
            className="absolute top-2 left-2 z-[1] max-w-[70%] truncate rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/95 shadow-sm"
            style={{ background: `${color}cc` }}
          >
            {label}
          </span>
        )}

        {isInstalled && !showInstall && (
          <span
            className="absolute top-2 right-2 z-[2] flex items-center justify-center gap-0.5 rounded-lg
                       min-h-8 min-w-8 px-1.5
                       bg-gradient-to-b from-emerald-500 to-emerald-700 text-white
                       ring-2 ring-white/30 shadow-[0_2px_14px_rgba(0,0,0,0.55)]
                       pointer-events-none"
            title="Déjà dans ta bibliothèque"
            aria-label="Déjà dans ta bibliothèque"
          >
            <Library size={16} strokeWidth={2.5} className="shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" aria-hidden />
          </span>
        )}

        {canDownload && onDownload && !isInstalled && !showInstall && isStarting && (
          <div className="absolute top-2 right-2 z-[2] app-no-drag flex items-center gap-0.5">
            <div
              className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-black/60 px-2
                         text-white/95 backdrop-blur-sm shadow-md"
            >
              <Spinner size={15} />
              <span className="max-w-[4.5rem] truncate text-[9px] font-semibold leading-none">Démarrage</span>
            </div>
            <button
              type="button"
              title="Annuler"
              aria-label="Annuler le démarrage du téléchargement"
              onClick={e => {
                e.stopPropagation()
                onCancelDownloadStart?.()
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/12
                         bg-black/55 text-white/90 backdrop-blur-sm transition-colors
                         hover:bg-error/40 hover:text-white"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {canDownload && onDownload && !isInstalled && !showInstall && !isStarting && (
          <button
            type="button"
            title="Télécharger"
            onClick={e => { e.stopPropagation(); onDownload(game) }}
            className="app-no-drag absolute top-2 right-2 z-[1] flex h-7 w-7 items-center justify-center rounded-md
                       bg-black/55 text-white/90 backdrop-blur-sm
                       opacity-0 group-hover:opacity-100 transition-opacity duration-150
                       hover:bg-accent hover:text-[#1b2838]"
          >
            <Download size={14} strokeWidth={2} />
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 z-[1] p-2.5 pt-8">
          <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            {game.title_clean}
          </p>
          {views != null && views > 0 && (
            <p className="mt-1 flex items-center gap-1 text-[10px] font-medium tabular-nums text-white/80">
              <Eye size={11} className="shrink-0 opacity-90" aria-hidden />
              {views.toLocaleString('fr-FR')} vues
            </p>
          )}
        </div>

        {isStarting && (
          <div className="absolute inset-x-0 bottom-0 z-[2] border-t border-amber-500/20 bg-black/88 px-2 py-1.5 backdrop-blur-[2px]">
            <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 max-w-full rounded-full bg-amber-400/75 animate-pulse" />
            </div>
            <p className="flex items-center justify-between gap-1 text-[10px] font-medium leading-tight text-white/95">
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <Loader2 size={12} className="shrink-0 animate-spin text-amber-300" aria-hidden />
                Récupération du torrent…
              </span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onCancelDownloadStart?.()
                }}
                className="app-no-drag shrink-0 font-semibold text-amber-200/95 underline-offset-2 hover:underline"
              >
                Annuler
              </button>
            </p>
          </div>
        )}

        {showInstall && !isStarting && (
          <div className="absolute inset-x-0 bottom-0 z-[2] bg-black/82 backdrop-blur-[2px] px-2 py-1.5 border-t border-white/10">
            <div className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <div className="h-1 rounded-full bg-white/15 overflow-hidden mb-1">
                  <div
                    className="h-full bg-accent transition-[width] duration-300 rounded-full"
                    style={{ width: `${Math.round((activeDownload?.progress ?? 0) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-medium text-white/95 leading-tight truncate pr-0.5">
                  {activeDownload?.status === 'paused' && 'En pause'}
                  {activeDownload?.status === 'connecting' && 'Connexion…'}
                  {activeDownload?.status === 'stalled' && (activeDownload.error || 'Aucun seeder (pause ou réessaie)')}
                  {activeDownload?.status === 'extracting' && 'Extraction…'}
                  {activeDownload?.status === 'failed' && (activeDownload.error || 'Erreur')}
                  {activeDownload?.status === 'downloading' &&
                    `${Math.round((activeDownload?.progress ?? 0) * 100)} % · ${formatShortSpeed(activeDownload?.downloadSpeed ?? 0)}`}
                </p>
              </div>
              {activeDownload &&
                activeDownload.status !== 'done' &&
                activeDownload.status !== 'extracting' && (
                <button
                  type="button"
                  title="Supprimer le téléchargement"
                  aria-label="Supprimer le téléchargement"
                  onClick={handleRemoveTorrent}
                  className="app-no-drag mt-0.5 shrink-0 rounded p-0.5 text-white/55 transition-colors hover:bg-white/10 hover:text-error"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isStarting && (
        <div className="border-t border-white/[0.06] bg-[var(--color-bg-surface)] px-2 py-1.5">
          <span className="inline-block rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200/95">
            Préparation
          </span>
        </div>
      )}

      {showInstall && !isStarting && (
        <div className="px-2 py-1.5 bg-[var(--color-bg-surface)] border-t border-white/[0.06]">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Installation</p>
        </div>
      )}
    </div>
  )
}

function formatShortSpeed(bps: number) {
  if (bps > 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mo/s`
  if (bps > 1_000) return `${(bps / 1_000).toFixed(0)} ko/s`
  if (bps > 0) return `${Math.round(bps)} o/s`
  return '…'
}
