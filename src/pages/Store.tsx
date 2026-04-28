import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronLeft, X } from 'lucide-react'
import { getApiBase } from '../api/client'
import { gamesApi, type Game, type Category, type PopularHeroGame, type StoreRow } from '../api/games'
import { useApp } from '../context/AppContext'
import { GameGrid } from '../components/game/GameGrid'
import { GameCarouselRow } from '../components/game/GameCarouselRow'
import { StoreCarouselsSkeleton } from '../components/game/StoreCarouselsSkeleton'
import { StorePopularHero } from '../components/game/StorePopularHero'
import { GameDetailPanel } from '../components/game/GameDetailPanel'
import { Spinner } from '../components/ui/Spinner'
import { CATEGORY_LABELS } from '../lib/categories'
import { getBoolPref, PREF_AUTO_SHORTCUT } from '../lib/preferences'

type View = 'home' | 'category' | 'search'

export function Store() {
  const { state, dispatch } = useApp()
  const [view, setView] = useState<View>('home')
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [totalGames, setTotalGames] = useState(0)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Game[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)

  const [categoryGames, setCategoryGames] = useState<Game[]>([])
  const [categoryTotal, setCategoryTotal] = useState(0)
  const [categoryPage, setCategoryPage] = useState(1)
  const [categoryPages, setCategoryPages] = useState(1)
  const [categoryLoading, setCategoryLoading] = useState(false)

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [homeRows, setHomeRows] = useState<StoreRow[]>([])
  const [homeLoading, setHomeLoading] = useState(true)
  const [heroGames, setHeroGames] = useState<PopularHeroGame[]>([])
  const [heroLoading, setHeroLoading] = useState(true)

  // Un seul appel réseau remplace les 3+ useEffect précédents
  useEffect(() => {
    gamesApi.storeHome()
      .then(data => {
        setTotalGames(data.total)
        setHomeRows(data.rows)
        setHeroGames(data.hero)
      })
      .catch(() => {})
      .finally(() => {
        setHomeLoading(false)
        setHeroLoading(false)
      })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 280)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([])
      setSearchTotal(0)
      setView(v => (v === 'search' ? 'home' : v))
      return
    }
    setView('search')
    setSearchLoading(true)
    gamesApi.search({ q: debouncedSearch, limit: 60 })
      .then(res => { setSearchResults(res.games); setSearchTotal(res.total) })
      .finally(() => setSearchLoading(false))
  }, [debouncedSearch])

  const loadCategory = useCallback(async (cat: Category, page: number) => {
    setCategoryLoading(true)
    const res = await gamesApi.list({ category: cat.category, limit: 60, page, sort: 'popular' })
    setCategoryGames(res.games)
    setCategoryTotal(res.total)
    setCategoryPages(res.pages)
    setCategoryLoading(false)
  }, [])

  function openCategory(cat: Category) {
    setActiveCategory(cat)
    setCategoryPage(1)
    setView('category')
    loadCategory(cat, 1)
  }

  function goHome() {
    setView('home')
    setActiveCategory(null)
    setSearch('')
  }

  /** Identifiant d’annulation du fetch .torrent côté process principal (évite de cloner le buffer via IPC). */
  const downloadStartRequestIds = useRef<Map<string, string>>(new Map())
  const [downloadStartingIds, setDownloadStartingIds] = useState(() => new Set<string>())

  const addDownloadStarting = useCallback((id: string) => {
    setDownloadStartingIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const removeDownloadStarting = useCallback((id: string) => {
    setDownloadStartingIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const cancelDownloadStart = useCallback((gameId: string) => {
    const rid = downloadStartRequestIds.current.get(gameId)
    if (rid) void window.electron.torrent.cancelAddFromUrl(rid)
  }, [])

  const handleDownload = useCallback(async (game: Game | PopularHeroGame) => {
    if (state.downloads.some(d => d.gameId === game.id && d.status !== 'done')) return
    if (downloadStartRequestIds.current.has(game.id)) return

    const requestId = crypto.randomUUID()
    downloadStartRequestIds.current.set(game.id, requestId)
    addDownloadStarting(game.id)
    try {
      const torrentUrl = `${getApiBase()}/api/games/${game.id}/torrent`
      const { infoHash } = await window.electron.torrent.addFromUrl(
        torrentUrl,
        state.downloadDir,
        game.id,
        game.title_clean,
        getBoolPref(PREF_AUTO_SHORTCUT, true),
        requestId,
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
          savePath:      null,
          error:         null,
          startedAt:     Date.now(),
        },
      })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      console.error('Download error:', e)
    } finally {
      downloadStartRequestIds.current.delete(game.id)
      removeDownloadStarting(game.id)
    }
  }, [addDownloadStarting, dispatch, removeDownloadStarting, state.downloadDir, state.downloads])

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-6 pb-4 shadow-[0_1px_0_var(--hairline)] space-y-4">

          {view !== 'home' && (
            <div className="flex items-center min-h-[1.75rem]">
              <button
                type="button"
                onClick={goHome}
                className="app-no-drag inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 -ml-2 text-xs text-muted hover:text-primary hover:bg-hover transition-colors"
              >
                <ChevronLeft size={14} className="shrink-0" strokeWidth={2} aria-hidden />
                <span className="font-medium">Magasin</span>
              </button>
            </div>
          )}

          {/* Titre + recherche sur une ligne (recherche à droite dès md) */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
            {view === 'home' && (
              <div className="flex items-baseline gap-3 min-w-0">
                <h1 className="text-lg font-bold text-white">Catalogue</h1>
                <span className="text-sm text-muted">{totalGames.toLocaleString()} jeux disponibles</span>
              </div>
            )}
            {view === 'category' && activeCategory && (
              <div className="flex items-baseline gap-3 min-w-0">
                <h1 className="text-lg font-bold text-white">
                  {CATEGORY_LABELS[activeCategory.category] || activeCategory.category}
                </h1>
                <span className="text-sm text-muted">{categoryTotal.toLocaleString()} jeux</span>
              </div>
            )}
            {view === 'search' && (
              <div className="flex items-baseline gap-3 min-w-0">
                <h1 className="text-lg font-bold text-white">Résultats</h1>
                <span className="text-sm text-muted">{searchTotal.toLocaleString()} jeu{searchTotal > 1 ? 'x' : ''}</span>
              </div>
            )}

            <div className="relative w-full md:max-w-md md:flex-shrink-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-[1]" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher des jeux…"
                className={`w-full fx-search-field rounded-lg
                           text-sm text-primary placeholder:text-muted/90 pl-10 py-2.5
                           focus:outline-none transition-[box-shadow] duration-150
                           ${search ? 'pr-9' : 'pr-3'}`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary app-no-drag"
                  aria-label="Effacer la recherche"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {view === 'home' && (
            <>
              <StorePopularHero
                games={heroGames}
                loading={heroLoading}
                onSelect={g => setSelectedGameId(g.id)}
                onDownload={handleDownload}
                downloadStartingIds={downloadStartingIds}
                onCancelDownloadStart={cancelDownloadStart}
              />
              <div className="p-6 pb-10">
                {homeLoading ? (
                  <StoreCarouselsSkeleton />
                ) : homeRows.every(r => r.games.length === 0) ? (
                  <EmptyState text="Aucun jeu dans le catalogue" />
                ) : (
                  homeRows
                    .filter(r => r.games.length > 0)
                    .map(row => {
                      const cat: Category = { category: row.category, count: row.count }
                      return (
                        <GameCarouselRow
                          key={row.category}
                          category={cat}
                          games={row.games}
                          onSeeAll={() => openCategory(cat)}
                          onSelect={g => setSelectedGameId(g.id)}
                          onDownload={handleDownload}
                          downloadStartingIds={downloadStartingIds}
                          onCancelDownloadStart={cancelDownloadStart}
                        />
                      )
                    })
                )}
              </div>
            </>
          )}

          {view === 'search' && (
            <div className="p-6">
              {searchLoading ? (
                <div className="flex items-center justify-center h-40"><Spinner size={24} /></div>
              ) : searchResults.length === 0 ? (
                <EmptyState text={`Aucun résultat pour « ${debouncedSearch} »`} />
              ) : (
                <GameGrid
                  games={searchResults}
                  onSelect={g => setSelectedGameId(g.id)}
                  onDownload={handleDownload}
                  downloadStartingIds={downloadStartingIds}
                  onCancelDownloadStart={cancelDownloadStart}
                  comfortable
                />
              )}
            </div>
          )}

          {view === 'category' && (
            <div className="p-6 space-y-4">
              {categoryLoading ? (
                <div className="flex items-center justify-center h-40"><Spinner size={24} /></div>
              ) : categoryGames.length === 0 ? (
                <EmptyState text="Aucun jeu dans cette catégorie" />
              ) : (
                <>
                  <GameGrid
                    games={categoryGames}
                    onSelect={g => setSelectedGameId(g.id)}
                    onDownload={handleDownload}
                    downloadStartingIds={downloadStartingIds}
                    onCancelDownloadStart={cancelDownloadStart}
                    comfortable
                  />
                  {categoryPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <button
                        disabled={categoryPage <= 1}
                        onClick={() => { const p = categoryPage - 1; setCategoryPage(p); loadCategory(activeCategory!, p) }}
                        className="text-sm text-muted hover:text-primary disabled:opacity-30 transition-colors"
                      >
                        ← Précédent
                      </button>
                      <span className="text-xs text-muted tabular-nums">{categoryPage} / {categoryPages}</span>
                      <button
                        disabled={categoryPage >= categoryPages}
                        onClick={() => { const p = categoryPage + 1; setCategoryPage(p); loadCategory(activeCategory!, p) }}
                        className="text-sm text-muted hover:text-primary disabled:opacity-30 transition-colors"
                      >
                        Suivant →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <GameDetailPanel gameId={selectedGameId} onClose={() => setSelectedGameId(null)} />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48">
      <p className="text-sm text-muted">{text}</p>
    </div>
  )
}
