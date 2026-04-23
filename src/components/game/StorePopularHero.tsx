import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import type { PopularHeroGame } from '../../api/games'
import { heroBackdropCandidates } from '../../api/client'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../lib/categories'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

const ROTATE_MS = 8_000

function formatReleased(date: string | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' })
}

interface StorePopularHeroProps {
  games: PopularHeroGame[]
  loading: boolean
  onSelect: (game: PopularHeroGame) => void
  onDownload: (game: PopularHeroGame) => void
  downloadStartingIds: ReadonlySet<string>
  onCancelDownloadStart: (gameId: string) => void
}

export function StorePopularHero({
  games,
  loading,
  onSelect,
  onDownload,
  downloadStartingIds,
  onCancelDownloadStart,
}: StorePopularHeroProps) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const gameIdsKey = games.map(g => g.id).join(',')
  useEffect(() => {
    setActive(0)
  }, [gameIdsKey])

  useEffect(() => {
    if (games.length <= 1 || paused) return
    const t = window.setInterval(() => {
      setActive(i => (i + 1) % games.length)
    }, ROTATE_MS)
    return () => window.clearInterval(t)
  }, [games.length, paused])

  const go = useCallback(
    (dir: -1 | 1) => {
      if (!games.length) return
      setActive(i => (i + dir + games.length) % games.length)
    },
    [games.length],
  )

  if (loading) {
    return (
      <section
        className="shrink-0 shadow-[0_1px_0_var(--hairline)] bg-surface"
        aria-hidden
      >
        <div className="min-h-[380px] px-4 sm:px-6 py-10 flex flex-col justify-end gap-4 max-w-3xl">
          <div className="h-6 w-40 rounded bg-elevated animate-pulse" />
          <div className="h-10 max-w-xl w-[85%] rounded bg-elevated animate-pulse" />
          <div className="h-4 w-full max-w-lg rounded bg-elevated/80 animate-pulse" />
          <div className="h-4 max-w-lg w-5/6 rounded bg-elevated/80 animate-pulse" />
          <div className="flex justify-center gap-2 pt-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-2 w-2 shrink-0 rounded-full bg-elevated animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (!games.length) return null

  const safeIndex = Math.min(active, games.length - 1)
  const current = games[safeIndex]

  const label = current.category ? (CATEGORY_LABELS[current.category] || current.category) : null
  const color = current.category ? CATEGORY_COLORS[current.category] : undefined
  const released = formatReleased(current.release_date)
  const modesRaw = current.modes_fr?.trim() || current.modes?.trim() || ''
  // Certaines fiches ont « 0 » ou un nombre seul en modes — inutile à l’affichage
  const modes =
    modesRaw && modesRaw !== '0' && !/^\d+$/.test(modesRaw) ? modesRaw : null
  const views = current.views
  const blurb =
    current.hero_blurb?.trim() ||
    'Sélection mise en avant dans le catalogue — ouvrez la fiche du jeu pour le synopsis, le torrent et l’installation.'

  return (
    <section
      className="shrink-0 relative min-h-[380px] w-full overflow-hidden shadow-[0_1px_0_var(--hairline)] text-left"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {games.map((game, i) => {
        const isOn = i === safeIndex
        return (
          <div
            key={game.id}
            className={`absolute inset-0 transition-opacity duration-[700ms] ease-out ${
              isOn ? 'opacity-100 z-0' : 'opacity-0 z-0 pointer-events-none'
            }`}
            aria-hidden={!isOn}
          >
            <HeroBackdrop game={game} />
            <div
              className="absolute inset-0 bg-gradient-to-r from-base via-base/90 to-base/35"
              style={{ boxShadow: 'inset 0 -72px 100px -36px var(--color-bg-base)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-base via-transparent to-base/50" />
          </div>
        )
      })}

      <div className="relative z-10 flex min-h-[380px] items-stretch">
        <div className="flex w-10 shrink-0 items-center justify-center sm:w-12">
          <button
            type="button"
            aria-label="Jeu précédent"
            onClick={() => go(-1)}
            disabled={games.length <= 1}
            className="app-no-drag flex h-10 w-9 items-center justify-center rounded-md ring-1 ring-white/[0.08] bg-surface/90 text-primary shadow-md transition-[box-shadow,background-color,color] hover:ring-accent/40 hover:bg-hover hover:text-white disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-center px-1 py-8 sm:px-2 sm:py-9">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md ring-1 ring-accent/30 bg-surface/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent shadow-sm">
              <Sparkles size={12} className="opacity-90 shrink-0" aria-hidden />
              À la une
            </span>
            {label && (
              <span
                className={`inline-flex items-center rounded-md bg-surface/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary shadow-sm ${
                  color ? '' : 'ring-1 ring-white/[0.08]'
                }`}
                style={color ? { color, boxShadow: `0 0 0 1px ${color}55` } : undefined}
              >
                {label}
              </span>
            )}
          </div>

          <h2 className="text-2xl font-bold leading-tight tracking-tight text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] sm:text-3xl">
            {current.title_clean}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {views != null && views > 0 && (
              <span className="inline-flex items-center gap-1.5 tabular-nums text-primary">
                <Eye size={15} className="text-accent opacity-90 shrink-0" aria-hidden />
                {views.toLocaleString('fr-FR')} vues
              </span>
            )}
            {released && <span>Sorti&nbsp;: {released}</span>}
            {modes && (
              <span className="max-w-[min(100%,18rem)] truncate" title={modes}>
                {modes}
              </span>
            )}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-primary/90 line-clamp-4 max-w-lg drop-shadow-sm">
            {blurb}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="app-no-drag shadow-md"
              onClick={() => onSelect(current)}
            >
              Voir la fiche
              <ChevronRight size={18} strokeWidth={2.5} className="opacity-95" aria-hidden />
            </Button>
            {current.hasTorrent && (
              downloadStartingIds.has(current.id) ? (
                <div className="app-no-drag flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2.5 rounded-md border border-amber-500/35 bg-surface/80 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm shadow-sm">
                    <Spinner size={17} />
                    Préparation du torrent…
                  </span>
                  <button
                    type="button"
                    onClick={() => onCancelDownloadStart(current.id)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-amber-200/95 underline-offset-2 ring-1 ring-white/10 bg-surface/50 hover:underline"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onDownload(current)}
                  className="app-no-drag inline-flex items-center gap-2 rounded-md ring-1 ring-white/[0.1] bg-surface/70 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm transition-[box-shadow,background-color] hover:ring-accent/35 hover:bg-hover"
                >
                  <Download size={17} aria-hidden />
                  Télécharger
                </button>
              )
            )}
          </div>

          <div className="mt-8 flex flex-col items-center gap-2.5 sm:mt-10">
            <div
              className="flex flex-nowrap items-center justify-center gap-2.5 px-2 max-w-full overflow-x-auto no-scrollbar py-1"
              role="tablist"
              aria-label="Choisir un jeu à la une"
            >
              {games.map((game, i) => {
                const on = i === safeIndex
                return (
                  <button
                    key={game.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    title={game.title_clean}
                    aria-label={`${game.title_clean}, diapositive ${i + 1}`}
                    onClick={() => setActive(i)}
                    className={`app-no-drag shrink-0 rounded-full transition-[width,height,background-color,box-shadow] duration-200 ${
                      on
                        ? 'h-2.5 w-8 bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.35)]'
                        : 'h-2.5 w-2.5 bg-primary/55 ring-1 ring-white/35 hover:bg-primary/80 hover:ring-white/55'
                    }`}
                  />
                )
              })}
            </div>
            <p className="text-[11px] tabular-nums text-muted/95">
              Diapositive {safeIndex + 1} sur {games.length}
            </p>
          </div>
        </div>

        <div className="flex w-10 shrink-0 items-center justify-center sm:w-12">
          <button
            type="button"
            aria-label="Jeu suivant"
            onClick={() => go(1)}
            disabled={games.length <= 1}
            className="app-no-drag flex h-10 w-9 items-center justify-center rounded-md ring-1 ring-white/[0.08] bg-surface/90 text-primary shadow-md transition-[box-shadow,background-color,color] hover:ring-accent/40 hover:bg-hover hover:text-white disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </div>
      </div>
    </section>
  )
}

/** Fond hero avec repli si CDN Steam / library_hero échoue ou URL avec ?t= obsolète. */
function HeroBackdrop({ game }: { game: PopularHeroGame }) {
  const candidates = useMemo(
    () => heroBackdropCandidates(game),
    [game],
  )
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [game.id, candidates])

  const src = idx < candidates.length ? candidates[idx] : null

  if (!src) {
    return <div className="absolute inset-0 bg-elevated" />
  }

  return (
    <img
      key={`${game.id}-${idx}`}
      src={src}
      alt=""
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover object-center"
      onError={() => setIdx(i => i + 1)}
    />
  )
}
