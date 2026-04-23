/** Squelette des rayons du magasin (aligné sur GameCarouselRow) pendant le chargement du catalogue. */
const ROWS = 4
const CARDS_PER_ROW = 6

export function StoreCarouselsSkeleton() {
  return (
    <div className="space-y-0" aria-busy="true" aria-label="Chargement du catalogue">
      {Array.from({ length: ROWS }).map((_, row) => (
        <section key={row} className="mb-9 last:mb-2" aria-hidden>
          <header className="flex items-center justify-between gap-4 mb-3.5">
            <div className="flex items-baseline gap-3 min-w-0 pl-2.5 border-l-2 border-white/[0.08]">
              <div className="h-4 w-32 sm:w-40 max-w-[min(100%,14rem)] rounded bg-elevated animate-pulse" />
              <div className="h-3 w-8 rounded bg-elevated/70 animate-pulse hidden sm:block shrink-0" />
            </div>
            <div className="h-3 w-12 rounded bg-elevated/50 animate-pulse shrink-0" />
          </header>

          <div className="relative -mx-1">
            <div className="overflow-hidden px-1">
              <div className="flex -ml-3 touch-pan-y">
                {Array.from({ length: CARDS_PER_ROW }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-[0_0_236px] sm:flex-[0_0_268px] min-w-0 pl-3"
                  >
                    <div
                      className="relative rounded-lg overflow-hidden ring-1 ring-white/[0.04]
                                 select-none pointer-events-none"
                    >
                      <div className="relative aspect-[3/2] bg-elevated animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
