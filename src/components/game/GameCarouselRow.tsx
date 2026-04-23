import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Category, Game } from '../../api/games'
import { GameCard } from './GameCard'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../lib/categories'

interface GameCarouselRowProps {
  category: Category
  games: Game[]
  onSeeAll: () => void
  onSelect: (game: Game) => void
  onDownload: (game: Game) => void
  downloadStartingIds: ReadonlySet<string>
  onCancelDownloadStart: (gameId: string) => void
}

export function GameCarouselRow({
  category,
  games,
  onSeeAll,
  onSelect,
  onDownload,
  downloadStartingIds,
  onCancelDownloadStart,
}: GameCarouselRowProps) {
  const label = CATEGORY_LABELS[category.category] || category.category
  const accent = CATEGORY_COLORS[category.category] || 'var(--color-accent-dim)'

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  })

  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const updateButtons = useCallback(() => {
    if (!emblaApi) return
    setCanPrev(emblaApi.canScrollPrev())
    setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    updateButtons()
    emblaApi.on('select', updateButtons)
    emblaApi.on('reInit', updateButtons)
    return () => {
      emblaApi.off('select', updateButtons)
      emblaApi.off('reInit', updateButtons)
    }
  }, [emblaApi, updateButtons])

  useEffect(() => {
    emblaApi?.reInit()
  }, [emblaApi, games])

  if (games.length === 0) return null

  return (
    <section className="group/row relative mb-9 last:mb-2">
      <header className="flex items-center justify-between gap-4 mb-3.5">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2
            className="text-sm font-bold text-white tracking-tight truncate pl-2.5 border-l-2 border-transparent"
            style={{ borderLeftColor: accent }}
          >
            {label}
          </h2>
          <span
            className="text-[11px] text-muted tabular-nums shrink-0 hidden sm:inline"
            title={`${category.count.toLocaleString()} jeux dans cette catégorie`}
          >
            {category.count.toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="shrink-0 text-[11px] font-semibold text-accent hover:text-[var(--color-accent-hover)] transition-colors app-no-drag"
        >
          Tout voir
        </button>
      </header>

      <div className="relative -mx-1">
        <div className="overflow-hidden px-1" ref={emblaRef}>
          <div className="flex -ml-3 touch-pan-y">
            {games.map(game => (
              <div className="flex-[0_0_236px] sm:flex-[0_0_268px] min-w-0 pl-3" key={game.id}>
                <GameCard
                  game={game}
                  onSelect={onSelect}
                  onDownload={onDownload}
                  isDownloadStarting={downloadStartingIds.has(game.id)}
                  onCancelDownloadStart={() => onCancelDownloadStart(game.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {canPrev && (
          <div
            className="absolute left-0 top-0 bottom-0 w-12 z-[1] flex items-center justify-start pl-0.5
                       bg-gradient-to-r from-[var(--color-bg-base)] via-[var(--color-bg-base)]/85 to-transparent
                       opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 pointer-events-none"
          >
            <button
              type="button"
              aria-label="Défiler vers la gauche"
              onClick={scrollPrev}
              className="app-no-drag pointer-events-auto flex h-24 w-9 items-center justify-center rounded-md
                         text-white/85 hover:text-white bg-black/25 hover:bg-black/40 transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
          </div>
        )}
        {canNext && (
          <div
            className="absolute right-0 top-0 bottom-0 w-12 z-[1] flex items-center justify-end pr-0.5
                       bg-gradient-to-l from-[var(--color-bg-base)] via-[var(--color-bg-base)]/85 to-transparent
                       opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 pointer-events-none"
          >
            <button
              type="button"
              aria-label="Défiler vers la droite"
              onClick={scrollNext}
              className="app-no-drag pointer-events-auto flex h-24 w-9 items-center justify-center rounded-md
                         text-white/85 hover:text-white bg-black/25 hover:bg-black/40 transition-colors"
            >
              <ChevronRight size={22} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
