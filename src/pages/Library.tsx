import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Search, X, ChevronDown, ListFilter, Check } from 'lucide-react'
import { gamesApi, type Game } from '../api/games'
import { useApp } from '../context/AppContext'
import { GameGrid } from '../components/game/GameGrid'
import { GameDetailPanel } from '../components/game/GameDetailPanel'
import { Spinner } from '../components/ui/Spinner'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/categories'

export function Library() {
  const { state } = useApp()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterWrapRef = useRef<HTMLDivElement>(null)

  const downloadsStableKey = useMemo(
    () => state.downloads.map(d => `${d.gameId}:${d.status}`).join('|'),
    [state.downloads],
  )

  const installationsStableKey = useMemo(
    () => state.installations.map(i => i.gameId).join('|'),
    [state.installations],
  )

  const libraryGameIds = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []
    for (const d of state.downloads) {
      if (d.status === 'done') continue
      if (!seen.has(d.gameId)) {
        seen.add(d.gameId)
        order.push(d.gameId)
      }
    }
    for (const i of state.installations) {
      if (!seen.has(i.gameId)) {
        seen.add(i.gameId)
        order.push(i.gameId)
      }
    }
    for (const d of state.downloads) {
      if (d.status !== 'done') continue
      if (!seen.has(d.gameId)) {
        seen.add(d.gameId)
        order.push(d.gameId)
      }
    }
    return order
    // eslint-disable-next-line react-hooks/exhaustive-deps -- éviter state.downloads (tick progression)
  }, [downloadsStableKey, installationsStableKey])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 280)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setCategory('') }, [debouncedSearch])

  const gamesRef = useRef<Game[]>([])
  useEffect(() => {
    gamesRef.current = games
  }, [games])

  const loadLibraryGames = useCallback(async () => {
    if (libraryGameIds.length === 0) {
      setGames([])
      setLoading(false)
      return
    }
    const quietLoad = gamesRef.current.length > 0
    if (!quietLoad) setLoading(true)
    try {
      const rows = await Promise.all(
        libraryGameIds.map(id =>
          gamesApi.get(id).catch(() => null),
        ),
      )
      const ok = rows.filter((g): g is Game => g != null)
      const byId = new Map(ok.map(g => [g.id, g]))
      const ordered = libraryGameIds.map(id => byId.get(id)).filter((g): g is Game => g != null)
      setGames(ordered)
    } catch (e) {
      console.error('Failed to load library games:', e)
      setGames([])
    } finally {
      setLoading(false)
    }
  }, [libraryGameIds])

  useEffect(() => { void loadLibraryGames() }, [loadLibraryGames])

  useEffect(() => {
    if (!filterOpen) return
    const onDown = (e: MouseEvent) => {
      const el = filterWrapRef.current
      if (el && !el.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [filterOpen])

  const categoriesPresent = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of games) {
      if (!g.category) continue
      m.set(g.category, (m.get(g.category) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [games])

  const filteredGames = useMemo(() => {
    let list = games
    if (category) list = list.filter(g => g.category === category)
    const q = debouncedSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        g =>
          g.title_clean.toLowerCase().includes(q) ||
          (g.title && g.title.toLowerCase().includes(q)),
      )
    }
    return list
  }, [games, category, debouncedSearch])

  const hasFilter = category !== '' || debouncedSearch !== ''

  const categoryLabel = category ? (CATEGORY_LABELS[category] || category) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Une seule « ligne » de hauteur : gauche = recherche + grille, droite = fiche pleine hauteur */}
      <div className="flex flex-1 min-h-0 flex-row overflow-hidden">
        <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="shrink-0 px-6 py-4 shadow-[0_1px_0_var(--hairline)]">
        <div className="flex flex-wrap items-center gap-3">
          <div ref={filterWrapRef} className="relative flex-1 min-w-[min(100%,20rem)] max-w-3xl">
            <div
              className="flex rounded-lg fx-search-field overflow-hidden transition-[box-shadow] duration-150"
            >
              <div className="relative flex-1 min-w-0 flex items-center">
                <Search size={15} className="absolute left-3 text-muted pointer-events-none shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher dans ma bibliothèque…"
                  className={`w-full min-w-0 bg-transparent text-sm text-primary placeholder:text-muted/90
                             pl-10 pr-3 py-2.5 focus:outline-none
                             ${search ? 'pr-10' : ''}`}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted hover:text-primary app-no-drag"
                    aria-label="Effacer la recherche"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="w-px shrink-0 bg-[var(--hairline-strong)] my-2" aria-hidden />

              <button
                type="button"
                onClick={() => setFilterOpen(o => !o)}
                className="app-no-drag shrink-0 flex items-center gap-2 pl-3 pr-3 py-2.5 text-xs font-semibold
                           text-primary hover:bg-hover transition-colors border-l border-transparent -ml-px"
                aria-expanded={filterOpen}
                aria-haspopup="listbox"
              >
                <ListFilter size={15} className="text-muted shrink-0" />
                <span className="truncate max-w-[7.5rem] sm:max-w-[10rem]">
                  {categoryLabel ?? 'Catégorie'}
                </span>
                <ChevronDown size={14} className={`text-muted shrink-0 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {filterOpen && (
              <div
                className="absolute z-50 top-[calc(100%+6px)] right-0 w-[min(100vw-3rem,18rem)] rounded-lg ring-1 ring-white/[0.08]
                           bg-[var(--color-bg-surface)] shadow-xl py-1 max-h-[min(20rem,50vh)] overflow-y-auto"
                role="listbox"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={category === ''}
                  onClick={() => { setCategory(''); setFilterOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-hover transition-colors"
                >
                  <span className="w-4 shrink-0 flex justify-center">
                    {category === '' ? <Check size={14} className="text-accent" /> : null}
                  </span>
                  <span className="flex-1 min-w-0">Toutes les catégories</span>
                  <span className="text-[11px] text-muted tabular-nums">{games.length}</span>
                </button>
                {categoriesPresent.length > 0 && (
                  <div className="h-px bg-[var(--hairline)] mx-2 my-0.5" />
                )}
                {categoriesPresent.map(([cat, count]) => {
                  const active = category === cat
                  const col = CATEGORY_COLORS[cat]
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => { setCategory(cat); setFilterOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-hover transition-colors"
                    >
                      <span className="w-4 shrink-0 flex justify-center">
                        {active ? <Check size={14} className="text-accent" /> : null}
                      </span>
                      <span className="flex-1 min-w-0 truncate" style={{ color: active ? col : undefined }}>
                        {CATEGORY_LABELS[cat] || cat}
                      </span>
                      <span className="text-[11px] text-muted tabular-nums">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto shrink-0">
            <span className="text-xs text-muted tabular-nums whitespace-nowrap">
              {filteredGames.length}/{libraryGameIds.length}
            </span>
            {hasFilter && (
              <button
                type="button"
                onClick={() => { setSearch(''); setCategory('') }}
                className="text-xs font-medium text-muted hover:text-accent transition-colors whitespace-nowrap app-no-drag"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48"><Spinner size={24} /></div>
          ) : libraryGameIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 gap-2 px-6 text-center">
              <p className="text-sm text-muted max-w-md">
                Aucun jeu dans la bibliothèque. Lance un téléchargement depuis le{' '}
                <span className="text-primary">Magasin</span> : le jeu apparaît ici tout de suite avec la progression, puis reste une fois l’installation terminée.
              </p>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-sm text-muted">Aucun jeu ne correspond aux filtres</p>
              {hasFilter && (
                <button type="button" onClick={() => { setSearch(''); setCategory('') }} className="text-xs text-accent hover:underline app-no-drag">
                  Effacer les filtres
                </button>
              )}
            </div>
          ) : (
            <div className="p-6 pb-8">
              <GameGrid
                games={filteredGames}
                onSelect={g => setSelectedGameId(g.id)}
                compact={false}
                comfortable
              />
            </div>
          )}
          </div>
        </div>

        <GameDetailPanel
          gameId={selectedGameId}
          onClose={() => setSelectedGameId(null)}
        />
      </div>

    </div>
  )
}
