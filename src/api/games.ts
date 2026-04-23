import { apiFetch, apiFetchBinary } from './client'

export interface Game {
  id: string
  title: string
  title_clean: string
  category: string | null
  image_url: string | null
  steam_app_id?: number | null
  release_date: string | null
  /** Libellé modes (FR ou brut) — préférer modes_fr si présent (jeux issus de l'ancien flux) */
  modes: string | null
  modes_fr: string | null
  views: number | null
  analyzed: number
  // Detail fields (GET /api/games/:id only)
  source_url?: string
  game_info?: string | null
  game_info_fr?: string | null
  youtube_url?: string | null
  hasTorrent?: boolean
}

/** Réponse de GET /api/games/popular — texte court pour le bandeau d'accueil */
export interface PopularHeroGame extends Game {
  hero_blurb: string | null
  /** Image large type Steam (header) si enrichissement Steam actif côté API */
  hero_image_url?: string | null
}

export interface GamesResponse {
  total: number
  page: number
  limit: number
  pages: number
  games: Game[]
}

export interface Category {
  category: string
  count: number
}

export interface StoreRow {
  category: string
  count:    number
  games:    Game[]
}

export interface StoreHomeResponse {
  total:      number
  categories: Category[]
  rows:       StoreRow[]
  hero:       PopularHeroGame[]
}

export interface Stats {
  total: number
  analyzed: number
  withTorrent: number
  categories: Category[]
}

export const gamesApi = {
  list(params: { page?: number; limit?: number; category?: string; sort?: 'new' | 'popular' } = {}) {
    const qs = new URLSearchParams()
    if (params.page)      qs.set('page',      String(params.page))
    if (params.limit)     qs.set('limit',     String(params.limit))
    if (params.category) qs.set('category',  params.category)
    if (params.sort)      qs.set('sort',      params.sort)
    return apiFetch<GamesResponse>(`/api/games?${qs}`)
  },

  popular(limit = 10) {
    const qs = new URLSearchParams({ limit: String(limit) })
    return apiFetch<{ games: PopularHeroGame[] }>(`/api/games/popular?${qs}`).then(r => r.games)
  },

  search(params: { q: string; category?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams()
    qs.set('q', params.q)
    if (params.category) qs.set('category', params.category)
    if (params.page)     qs.set('page',     String(params.page))
    if (params.limit)    qs.set('limit',    String(params.limit))
    return apiFetch<GamesResponse>(`/api/search?${qs}`)
  },

  get(id: string) {
    return apiFetch<Game>(`/api/games/${id}`)
  },

  categories() {
    return apiFetch<Category[]>('/api/games/categories')
  },

  stats() {
    return apiFetch<Stats>('/api/games/stats')
  },

  getTorrent(id: string, init?: { signal?: AbortSignal }): Promise<ArrayBuffer> {
    return apiFetchBinary(`/api/games/${id}/torrent`, init)
  },

  storeHome() {
    return apiFetch<StoreHomeResponse>('/api/store/home')
  },
}
