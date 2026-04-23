import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X, Download, Eye, Calendar, Gamepad2, ExternalLink, Play, Pause, FolderOpen, RotateCcw, Archive, Trash2, AlertTriangle, Loader2, Square, Clock, RefreshCw, WifiOff } from 'lucide-react'
import { gamesApi, type Game } from '../../api/games'
import { proxyImageUrl } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { Spinner } from '../ui/Spinner'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../lib/categories'
import { getBoolPref, PREF_AUTO_SHORTCUT } from '../../lib/preferences'
import { StopSeedingModal } from '../StopSeedingModal'
import { TorrentSwarmInfo } from '../torrent/TorrentSwarmInfo'
import { formatBitrate } from '../../lib/formatBitrate'

interface GameDetailPanelProps {
  gameId: string | null
  onClose: () => void
  extraActions?: ReactNode
}

export function GameDetailPanel({ gameId, onClose, extraActions }: GameDetailPanelProps) {
  const { state, dispatch } = useApp()
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [steamWarning, setSteamWarning] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [uninstallError, setUninstallError] = useState<string | null>(null)
  const [quickExitWarning, setQuickExitWarning] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stopSeedModalOpen, setStopSeedModalOpen] = useState(false)
  const launchTimeRef = useRef<number | null>(null)

  // Derived values computed before any early return so hooks stay stable
  const activeDownload = gameId ? state.downloads.find(d => d.gameId === gameId) : undefined
  const installRecord  = gameId ? state.installations.find(i => i.gameId === gameId) : undefined
  const activeSeed     = installRecord ? state.seeds.find(s => s.gameId === gameId) : undefined
  const installPath    =
    installRecord?.savePath
    ?? (activeDownload?.status === 'done' ? activeDownload.savePath : null)
    ?? null
  const showDownloadProgress = Boolean(activeDownload && activeDownload.status !== 'done')
  const isRunning = installPath ? state.runningGames.includes(installPath) : false

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    setGame(null)
    setLoadError(null)
    gamesApi.get(gameId)
      .then(g => {
        setGame(g)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        setGame(null)
        setLoadError(err instanceof Error ? err.message : 'Jeu introuvable')
      })
      .finally(() => setLoading(false))
  }, [gameId])

  // Détecte une sortie trop rapide (< 5s) — probable intervention de l'antivirus
  useEffect(() => {
    if (isRunning) {
      launchTimeRef.current = Date.now()
      setQuickExitWarning(false)
    } else if (launchTimeRef.current !== null) {
      const elapsed = Date.now() - launchTimeRef.current
      launchTimeRef.current = null
      if (elapsed < 5_000) {
        setQuickExitWarning(true)
        const t = setTimeout(() => setQuickExitWarning(false), 20_000)
        return () => clearTimeout(t)
      }
    }
  }, [isRunning])

  if (!gameId) return null

  async function getTorrentSource(id: string): Promise<ArrayBuffer> {
    return gamesApi.getTorrent(id)
  }

  async function handleDownload() {
    if (!game) return
    setFetching(true)
    setFetchError(null)
    try {
      const torrentBuffer = await getTorrentSource(game.id)
      const { infoHash, destPath } = await window.electron.torrent.add(
        torrentBuffer,
        state.downloadDir,
        game.id,
        game.title_clean,
        getBoolPref(PREF_AUTO_SHORTCUT, true),
      )
      dispatch({
        type: 'ADD_TORRENT',
        payload: {
          infoHash,
          gameId:        game.id,
          gameTitle:     game.title_clean,
          status:        'connecting',
          progress:      0,
          downloadSpeed: 0,
          downloaded:    0,
          length:        0,
          timeRemaining: 0,
          savePath:      destPath,
          error:         null,
          startedAt:     Date.now(),
        },
      })
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setFetching(false)
    }
  }

  async function handleRetry() {
    if (!game || !activeDownload) return
    setFetching(true)
    setFetchError(null)
    try {
      try { await window.electron.torrent.remove(activeDownload.infoHash) } catch { /* already gone */ }
      dispatch({ type: 'REMOVE_TORRENT', payload: activeDownload.infoHash })
      const torrentBuffer = await getTorrentSource(game.id)
      const { infoHash, destPath } = await window.electron.torrent.add(
        torrentBuffer, state.downloadDir, game.id, game.title_clean, getBoolPref(PREF_AUTO_SHORTCUT, true),
      )
      dispatch({
        type: 'ADD_TORRENT',
        payload: {
          infoHash, gameId: game.id, gameTitle: game.title_clean,
          status: 'connecting', progress: 0, downloadSpeed: 0,
          downloaded: 0, length: 0, timeRemaining: 0,
          savePath: destPath, error: null, startedAt: Date.now(),
        },
      })
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setFetching(false)
    }
  }

  async function handleReinstall() {
    if (!game) return
    setFetching(true)
    setFetchError(null)
    try {
      const hashes = new Set<string>()
      if (installRecord?.infoHash) hashes.add(installRecord.infoHash)
      for (const d of state.downloads) {
        if (d.gameId === game.id) hashes.add(d.infoHash)
      }
      for (const h of hashes) {
        try {
          await window.electron.torrent.remove(h)
        } catch {
          /* déjà absent côté WebTorrent */
        }
        dispatch({ type: 'REMOVE_TORRENT', payload: h })
      }
      dispatch({ type: 'REMOVE_INSTALLATION', payload: game.id })

      const torrentBuffer = await getTorrentSource(game.id)
      const { infoHash, destPath } = await window.electron.torrent.add(
        torrentBuffer,
        state.downloadDir,
        game.id,
        game.title_clean,
        getBoolPref(PREF_AUTO_SHORTCUT, true),
      )
      dispatch({
        type: 'ADD_TORRENT',
        payload: {
          infoHash,
          gameId:        game.id,
          gameTitle:     game.title_clean,
          status:        'connecting',
          progress:      0,
          downloadSpeed: 0,
          downloaded:    0,
          length:        0,
          timeRemaining: 0,
          savePath:      destPath,
          error:         null,
          startedAt:     Date.now(),
        },
      })
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setFetching(false)
    }
  }

  async function doLaunch() {
    if (!installPath || !game) return
    setLaunching(true)
    setSteamWarning(false)
    const result = await window.electron.game.launch(
      installRecord?.exePath || installPath,
      game.title_clean,
    )
    if (!result.ok) {
      setLaunching(false)
      setLaunchError(result.error ?? 'Impossible de lancer le jeu.')
      setTimeout(() => setLaunchError(null), 6000)
    } else {
      dispatch({ type: 'GAME_LAUNCHED', payload: installPath! })
      setLaunching(false)
    }
  }

  async function handleLaunch() {
    if (!installPath || !game) return
    const steamRunning = await window.electron.system.isSteamRunning()
    if (!steamRunning) {
      setSteamWarning(true)
      return
    }
    await doLaunch()
  }

  async function handlePause() {
    if (!activeDownload) return
    const r = await window.electron.torrent.pause(activeDownload.infoHash).catch(() => ({ ok: false }))
    if (r.ok) dispatch({ type: 'UPDATE_TORRENT', payload: { infoHash: activeDownload.infoHash, status: 'paused' } })
  }

  async function handleResume() {
    if (!activeDownload) return
    const r = await window.electron.torrent.resume(activeDownload.infoHash).catch(() => ({ ok: false }))
    if (r.ok) dispatch({ type: 'UPDATE_TORRENT', payload: { infoHash: activeDownload.infoHash, status: 'downloading' } })
  }

  async function handleCancel() {
    if (!activeDownload) return
    if (!window.confirm(`Annuler le téléchargement de ${activeDownload.gameTitle} ?`)) return
    await window.electron.torrent.remove(activeDownload.infoHash).catch(() => {})
    dispatch({ type: 'REMOVE_TORRENT', payload: activeDownload.infoHash })
  }

  async function handleUninstall() {
    if (!game || !installPath) return
    const ok = window.confirm(
      `Désinstaller ${game.title_clean} ?\n\nLe dossier d'installation sera supprimé définitivement.`
    )
    if (!ok) return
    setUninstalling(true)
    const result = await window.electron.game.uninstall(installPath)
    setUninstalling(false)
    if (result.ok) {
      dispatch({ type: 'REMOVE_INSTALLATION', payload: game.id })
      if (installRecord?.infoHash) dispatch({ type: 'REMOVE_TORRENT', payload: installRecord.infoHash })
    } else {
      setUninstallError(result.error ?? 'Erreur lors de la désinstallation.')
      setTimeout(() => setUninstallError(null), 6000)
    }
  }

  async function confirmStopSeed() {
    if (!activeSeed || !game) return
    setStopSeedModalOpen(false)
    // Persist opt-out so seeding doesn't restart on next launch
    try {
      const disabled: string[] = JSON.parse(localStorage.getItem('findx_seeding_disabled') ?? '[]')
      if (!disabled.includes(game.id)) {
        disabled.push(game.id)
        localStorage.setItem('findx_seeding_disabled', JSON.stringify(disabled))
      }
    } catch { /* ignore */ }
    await window.electron.torrent.stopSeed(activeSeed.infoHash).catch(() => {})
    dispatch({ type: 'REMOVE_SEED', payload: activeSeed.infoHash })
  }

  async function handleExtract() {
    let dest = installPath
    if (!dest) {
      dest = await window.electron.selectInstallFolder()
      if (!dest) return
    }
    const ih = installRecord?.infoHash ?? activeDownload?.infoHash ?? `manual-extract-${game?.id}`
    setExtracting(true)
    setExtractMsg(null)
    const result = await window.electron.install.extract(ih, dest, game?.title_clean ?? '', getBoolPref(PREF_AUTO_SHORTCUT, true))
    setExtracting(false)
    setExtractMsg(result.ok
      ? { ok: true,  text: 'Extraction réussie !' }
      : { ok: false, text: result.error ?? 'Erreur inconnue' },
    )
    setTimeout(() => setExtractMsg(null), 8000)
  }

  const catColor = game?.category ? CATEGORY_COLORS[game.category] : undefined

  return (
    <>
    {stopSeedModalOpen && game && activeSeed && (
      <StopSeedingModal
        gameTitle={game.title_clean}
        onKeep={() => setStopSeedModalOpen(false)}
        onStop={() => void confirmStopSeed()}
      />
    )}
    <aside
      className="w-[25rem] max-w-[min(25rem,100vw)] shrink-0 flex flex-col h-full min-h-0
                 bg-[var(--color-bg-base)] overflow-hidden
                 shadow-[-20px_0_48px_-16px_rgba(0,0,0,0.45)]"
    >
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-surface/40 shadow-[0_1px_0_var(--hairline)]">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Fiche</span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-primary transition-colors p-1.5 rounded-md hover:bg-hover app-no-drag"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <Spinner size={24} />
        </div>
      ) : game ? (
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {game.youtube_url ? (
            <div className="shrink-0 p-4 pb-0">
              <div className="rounded-lg overflow-hidden ring-1 ring-white/[0.06] bg-black aspect-video">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${extractYouTubeId(game.youtube_url)}`}
                  title="Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : game.image_url ? (
            <ImgOrNothing src={proxyImageUrl(game.image_url)!} alt={game.title_clean} />
          ) : null}

          <div className="p-4 space-y-4 flex-1 flex flex-col">
            <div>
              <h2 className="text-[15px] font-bold text-white leading-snug">{game.title_clean}</h2>
              {game.category && (
                <span
                  className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{
                    color: catColor ?? 'var(--color-accent)',
                    background: catColor ? `${catColor}22` : 'rgba(102,192,244,0.15)',
                  }}
                >
                  {CATEGORY_LABELS[game.category] || game.category}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {game.views != null && game.views > 0 && (
                <MetaPill icon={<Eye size={12} />} text={`${game.views.toLocaleString('fr-FR')} vues`} />
              )}
              {game.release_date && (
                <MetaPill icon={<Calendar size={12} />} text={game.release_date} />
              )}
              {(game.modes_fr || game.modes) && (
                <MetaPill
                  icon={<Gamepad2 size={12} />}
                  text={String(game.modes_fr || game.modes)}
                  className="max-w-full"
                />
              )}
            </div>

            {(game.game_info_fr || game.game_info) && (
              <p className="text-[13px] text-muted leading-relaxed">
                {game.game_info_fr || game.game_info}
              </p>
            )}

            {game.hasTorrent ? (
              <div className="mt-auto space-y-2.5 pt-1">
                {installPath ? (
                  <>
                    {/* Temps de jeu */}
                    {state.playtime[game.id] && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                        <Clock size={11} className="shrink-0" />
                        <span>{formatPlaytime(state.playtime[game.id].totalMs)}</span>
                        <span className="opacity-50">·</span>
                        <span>{state.playtime[game.id].sessionCount} session{state.playtime[game.id].sessionCount > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {/* Alerte sortie rapide (probable AV) */}
                    {quickExitWarning && (
                      <div
                        className="rounded-lg p-3 space-y-1.5"
                        style={{
                          background: 'rgba(217,143,0,0.08)',
                          border: '1px solid rgba(217,143,0,0.28)',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                          <div>
                            <p className="text-[12px] font-semibold" style={{ color: 'var(--color-warning)' }}>
                              Le jeu s'est arrêté immédiatement
                            </p>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                              Un antivirus a peut-être supprimé ou bloqué un fichier du jeu. Vérifiez les quarantaines de Windows Defender ou de votre antivirus, puis réessayez.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lancer / En cours */}
                    {isRunning ? (
                      <div className="space-y-2">
                        {/* Badge "jeu en cours" */}
                        <div
                          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg cursor-default"
                          style={{
                            background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
                            boxShadow: '0 0 0 1px color-mix(in srgb, var(--color-success) 28%, transparent)',
                            color: 'var(--color-success)',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" aria-hidden />
                          Jeu lancé
                        </div>
                        {/* Fermer le jeu */}
                        <button
                          type="button"
                          onClick={() => void window.electron.game.close(installPath!)}
                          className="w-full flex items-center justify-center gap-2 py-2 text-[12px] font-semibold rounded-lg
                                     text-muted hover:text-primary transition-colors app-no-drag"
                          style={{ boxShadow: '0 0 0 1px var(--hairline-strong)' }}
                        >
                          <Square size={12} fill="currentColor" className="shrink-0" />
                          Fermer le jeu
                        </button>
                        {/* Reset manuel si le jeu est bloqué sur "en cours" */}
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'GAME_EXITED', payload: installPath! })}
                          className="w-full py-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
                                     transition-colors app-no-drag"
                        >
                          Le jeu ne s'est pas lancé ?
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleLaunch()}
                        disabled={launching}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg
                                   bg-accent text-[#1b2838] hover:brightness-110 transition-[filter,opacity]
                                   disabled:opacity-80 app-no-drag"
                      >
                        {launching
                          ? <><Loader2 size={15} className="animate-spin shrink-0" />Lancement du jeu…</>
                          : <><Play size={15} fill="currentColor" className="opacity-90 shrink-0" />Lancer</>
                        }
                      </button>
                    )}

                    {/* Warning Steam */}
                    {steamWarning && (
                      <div
                        className="rounded-lg p-3 space-y-2.5"
                        style={{
                          background: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-surface))',
                          boxShadow: '0 0 0 1px color-mix(in srgb, var(--color-warning) 30%, transparent)',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                          <div>
                            <p className="text-[12px] font-semibold" style={{ color: 'var(--color-warning)' }}>
                              Steam n'est pas ouvert
                            </p>
                            <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                              La plupart des jeux online-fix nécessitent Steam pour fonctionner.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void doLaunch()}
                            className="flex-1 py-1.5 text-[11px] font-semibold rounded-md text-primary
                                       hover:bg-hover transition-colors app-no-drag"
                            style={{ boxShadow: '0 0 0 1px var(--hairline-strong)' }}
                          >
                            Lancer quand même
                          </button>
                          <button
                            type="button"
                            onClick={() => setSteamWarning(false)}
                            className="flex-1 py-1.5 text-[11px] font-semibold rounded-md text-muted
                                       hover:text-primary hover:bg-hover transition-colors app-no-drag"
                            style={{ boxShadow: '0 0 0 1px var(--hairline-strong)' }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}

                    {launchError && (
                      <p className="text-[11px] text-error leading-snug">{launchError}</p>
                    )}

                    {/* Dossier / Réinstaller */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void window.electron.openPath(installPath)}
                        className="flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-semibold rounded-lg
                                   ring-1 ring-white/[0.06] text-primary bg-surface/80
                                   hover:bg-hover transition-colors app-no-drag"
                      >
                        <FolderOpen size={14} className="shrink-0 opacity-90" />
                        Dossier
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReinstall()}
                        disabled={fetching}
                        title="Retélécharge depuis zéro"
                        className="flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-semibold rounded-lg
                                   ring-1 ring-white/[0.05] text-muted bg-transparent
                                   hover:text-primary hover:bg-hover transition-colors disabled:opacity-50 app-no-drag"
                      >
                        {fetching ? <Spinner size={14} /> : <RotateCcw size={14} />}
                        Réinstaller
                      </button>
                    </div>

                    {/* ── Partage / Seeding ─────────────────────────────── */}
                    {activeSeed ? (
                      <div
                        className="rounded-lg overflow-hidden"
                        style={{ border: '1px solid rgba(102,192,244,0.2)', background: 'rgba(102,192,244,0.04)' }}
                      >
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
                          <span className="text-[11px] font-semibold flex-1" style={{ color: '#66c0f4' }}>
                            Partage actif
                          </span>
                        </div>
                        <div
                          className="grid gap-px"
                          style={{ gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid rgba(102,192,244,0.12)' }}
                        >
                          <StatCell label="Upload" value={activeSeed.uploadSpeed > 0 ? `↑ ${formatBitrate(activeSeed.uploadSpeed)}` : '—'} />
                          <StatCell label="Pairs"  value={String(activeSeed.numPeers)} />
                          <StatCell label="Partagé" value={activeSeed.uploaded > 0 ? formatBytes(activeSeed.uploaded) : '0 B'} />
                        </div>
                        <button
                          type="button"
                          onClick={() => setStopSeedModalOpen(true)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium
                                     text-muted hover:text-primary transition-colors app-no-drag"
                          style={{ borderTop: '1px solid rgba(102,192,244,0.1)' }}
                        >
                          <WifiOff size={11} className="shrink-0" />
                          Arrêter le partage
                        </button>
                      </div>
                    ) : null}

                    {/* ── Désinstaller ──────────────────────────────────── */}
                    <button
                      type="button"
                      onClick={() => void handleUninstall()}
                      disabled={uninstalling}
                      className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-semibold rounded-lg
                                 transition-[background-color,box-shadow] disabled:opacity-50 app-no-drag"
                      style={{
                        color: 'var(--color-error)',
                        background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                        boxShadow: '0 0 0 1px color-mix(in srgb, var(--color-error) 22%, transparent)',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget
                        el.style.background = 'color-mix(in srgb, var(--color-error) 16%, transparent)'
                        el.style.boxShadow = '0 0 0 1px color-mix(in srgb, var(--color-error) 38%, transparent)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget
                        el.style.background = 'color-mix(in srgb, var(--color-error) 8%, transparent)'
                        el.style.boxShadow = '0 0 0 1px color-mix(in srgb, var(--color-error) 22%, transparent)'
                      }}
                    >
                      {uninstalling ? <Spinner size={13} /> : <Trash2 size={13} />}
                      {uninstalling ? 'Suppression…' : 'Désinstaller'}
                    </button>

                    {uninstallError && (
                      <p className="text-[11px] text-error leading-snug">{uninstallError}</p>
                    )}
                  </>
                ) : showDownloadProgress && activeDownload ? (
                  <DownloadProgress
                    download={activeDownload}
                    onRetry={handleRetry}
                    retrying={fetching}
                    onPause={handlePause}
                    onResume={handleResume}
                    onCancel={handleCancel}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={fetching}
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg
                                 bg-hover text-accent ring-1 ring-accent/35 shadow-[inset_0_1px_0_var(--hairline-strong)]
                                 hover:bg-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-bg-hover))]
                                 hover:ring-accent/50 transition-[background-color,box-shadow] disabled:opacity-50 app-no-drag"
                    >
                      {fetching ? <Spinner size={14} /> : <Download size={15} />}
                      {fetching ? 'Préparation…' : 'Télécharger'}
                    </button>
                    {fetchError && (
                      <p className="text-xs rounded-lg px-3 py-2 mt-2 flex items-start gap-1.5"
                         style={{ color: 'var(--color-error)', background: 'var(--color-error-subtle)' }}>
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        {fetchError.includes('522') || fetchError.includes('502') || fetchError.includes('Timeout')
                          ? 'Serveur online-fix.me inaccessible. Réessaie dans quelques instants.'
                          : fetchError}
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted italic">
                {game.analyzed
                  ? 'Aucun torrent disponible pour ce jeu.'
                  : 'Jeu non encore analysé.'}
              </p>
            )}

            {extraActions}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 shadow-[0_-1px_0_var(--hairline)]">
              {game.steam_app_id ? (
                <a
                  href={`https://store.steampowered.com/app/${game.steam_app_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-accent transition-colors"
                >
                  <ExternalLink size={12} />
                  Steam
                </a>
              ) : game.source_url ? (
                <a
                  href={game.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-accent transition-colors"
                >
                  <ExternalLink size={12} />
                  Source
                </a>
              ) : null}
              {game.hasTorrent && installPath && (
                <button
                  type="button"
                  onClick={() => void handleExtract()}
                  disabled={extracting}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-accent transition-colors disabled:opacity-50 app-no-drag"
                >
                  {extracting ? <Spinner size={12} /> : <Archive size={12} />}
                  {extracting ? 'Extraction…' : 'Extraire'}
                </button>
              )}
              {extractMsg && (
                <span className={`text-[11px] ${extractMsg.ok ? 'text-success' : 'text-error'}`}>
                  {extractMsg.text}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm text-muted py-16 px-4 text-center">
          <p className="font-medium text-[var(--color-text-primary)]">Jeu introuvable dans le catalogue</p>
          <p className="text-xs max-w-sm">
            {loadError || 'Ce jeu n’est plus listé (catalogue mis à jour ou pas de torrent local). Fermez le panneau et rouvrez-le depuis le magasin.'}
          </p>
        </div>
      )}
    </aside>
    </>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-2 px-1 gap-0.5">
      <span className="text-[10px] text-muted uppercase tracking-wide">{label}</span>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}

function MetaPill({ icon, text, className = '' }: { icon: ReactNode; text: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md ring-1 ring-white/[0.06] bg-surface/70 px-2 py-1 text-[11px] text-primary tabular-nums ${className}`}
    >
      <span className="text-muted shrink-0">{icon}</span>
      <span className="truncate max-w-[14rem]">{text}</span>
    </span>
  )
}

function DownloadProgress({
  download,
  onRetry,
  retrying,
  onPause,
  onResume,
  onCancel,
}: {
  download: ReturnType<typeof useApp>['state']['downloads'][0]
  onRetry?: () => void
  retrying?: boolean
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
}) {
  const pct    = Math.round(download.progress * 100)
  const failed = download.status === 'failed'
  return (
    <div
      className="space-y-2 p-3 rounded-lg"
      style={{
        background:  failed ? 'rgba(192,57,43,0.07)' : 'var(--color-bg-surface)',
        border: `1px solid ${failed ? 'rgba(192,57,43,0.25)' : 'var(--hairline-strong)'}`,
      }}
    >
      <div className="flex items-center justify-between text-xs">
        <span
          className="font-medium capitalize"
          style={{ color: failed ? 'var(--color-error)' : 'var(--color-text-primary)' }}
        >
          {statusLabel(download.status)}
        </span>
        {!failed && <span className="text-muted tabular-nums">{pct}%</span>}
      </div>

      {!failed && (
        <div className="h-1.5 bg-hover rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {download.status === 'downloading' && (
        <div className="text-[11px] text-muted tabular-nums">
          {formatBitrate(download.downloadSpeed)}
          {download.length > 0 && (
            <>
              {' · '}
              {formatBytes(download.downloaded)} / {formatBytes(download.length)}
            </>
          )}
          {Number.isFinite(download.timeRemaining) && download.timeRemaining > 0 && (
            <> · {formatEta(download.timeRemaining)}</>
          )}
        </div>
      )}

      {!failed && (download.status === 'connecting' || download.status === 'downloading' || download.status === 'stalled' || download.status === 'paused') && (
        <TorrentSwarmInfo entry={download} />
      )}

      {failed && download.error && (
        <p className="text-[11px] text-[var(--color-text-muted)] leading-snug truncate" title={download.error}>
          {download.error}
        </p>
      )}

      {/* Actions pause / resume / cancel */}
      {!failed && (onPause || onResume || onCancel) && (
        <div className="flex items-center gap-2 pt-0.5">
          {download.status === 'downloading' && onPause && (
            <button
              type="button"
              onClick={onPause}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md
                         bg-[var(--color-bg-surface)] border border-[var(--hairline-strong)]
                         text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
                         hover:border-[var(--color-border-light)] transition-colors app-no-drag"
            >
              <Pause size={11} className="shrink-0" />
              Pause
            </button>
          )}
          {download.status === 'paused' && onResume && (
            <button
              type="button"
              onClick={onResume}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md
                         bg-[var(--color-accent)] text-[#1b2838]
                         hover:bg-[var(--color-accent-hover)] transition-colors app-no-drag"
            >
              <Play size={11} fill="currentColor" className="shrink-0" />
              Reprendre
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md
                         bg-[var(--color-bg-surface)] border border-[var(--hairline-strong)]
                         text-[var(--color-text-muted)] hover:text-[var(--color-error)]
                         hover:border-[var(--color-error)]/40 transition-colors app-no-drag"
            >
              <X size={11} className="shrink-0" />
              Annuler
            </button>
          )}
        </div>
      )}

      {failed && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md
                     bg-[var(--color-bg-surface)] border border-[var(--hairline-strong)]
                     text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
                     hover:border-[var(--color-border-light)] transition-colors disabled:opacity-50 app-no-drag"
        >
          {retrying ? <Loader2 size={12} className="animate-spin shrink-0" /> : <RefreshCw size={12} className="shrink-0" />}
          {retrying ? 'Reprise…' : 'Réessayer'}
        </button>
      )}
    </div>
  )
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    connecting:  'Connexion…',
    downloading: 'En cours',
    extracting:  'Extraction…',
    paused:      'En pause',
    stalled:     'Réseau faible',
    done:        'Terminé',
    failed:      'Erreur',
  }
  return labels[status] || status
}

function formatBytes(bytes: number) {
  if (bytes > 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`
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

function formatPlaytime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin < 1)  return '< 1 min'
  if (totalMin < 60) return `${totalMin} min`
  const h   = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return min > 0 ? `${h}h ${min}min` : `${h}h`
}

function extractYouTubeId(url: string) {
  const m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/)
  return m ? m[1] : ''
}

function ImgOrNothing({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false)
  if (error) return null
  return (
    <div className="shrink-0 px-4 pt-4">
      <div className="rounded-lg overflow-hidden ring-1 ring-white/[0.06] bg-surface">
        <img
          src={src}
          alt={alt}
          className="w-full object-cover object-top max-h-[200px]"
          decoding="async"
          onError={() => setError(true)}
        />
      </div>
    </div>
  )
}
