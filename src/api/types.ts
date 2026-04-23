/**
 * findx API — TypeScript types
 *
 * Base URL : http://127.0.0.1:3001  (env VITE_API_URL)
 *            /health, /ws, /img/* sont publics ; /api/* est rate-limité côté serveur.
 *
 * WebSocket: ws://127.0.0.1:3001/ws — push-only, no client messages.
 *            Envelope format: { event: string, data: object }
 */

// ── Games ─────────────────────────────────────────────────────────────────────

/**
 * Returned by list/search endpoints:
 *   GET /api/games
 *   GET /api/search
 *   GET /api/games/popular  (+ hero_blurb / hero_image_url)
 *
 * `analyzed` is 0 | 1 (treat as boolean).
 * `hasTorrent` is always present on list results.
 */
export interface GameListItem {
  id:           string
  title:        string
  /** Cleaned title without version tags — use for display */
  title_clean:  string
  category:     string | null
  image_url:    string | null
  steam_app_id: number | null
  /** Free-form date string, e.g. "2024", "15 March 2024" */
  release_date: string | null
  /** Raw gameplay modes string from source (Russian origin) */
  modes:        string | null
  /** Translated gameplay modes (FR) — prefer over `modes` when present */
  modes_fr:     string | null
  /** Vues affichées sur Online-Fix (synchronisées depuis le JSON, pas d’incrément launcher) */
  views:        number | null
  /** 1 if game page was fully scraped, 0 if only listing was scraped */
  analyzed:     0 | 1
  /** True if at least one torrent link exists in download_links */
  hasTorrent:   boolean
}

/**
 * Full game detail — GET /api/games/:id  (SELECT * + hasTorrent)
 * Superset of GameListItem with content and metadata fields.
 */
export interface GameDetail extends GameListItem {
  /** Original source URL on online-fix.me */
  source_url:    string
  /** Raw game description HTML from source (may be Russian) */
  game_info:     string | null
  /** Machine-translated game description in French */
  game_info_fr:  string | null
  /** YouTube video URL for trailer */
  youtube_url:   string | null
  /** Unix timestamp (seconds) — row creation */
  created_at:    number
  /** Unix timestamp (seconds) — last update */
  updated_at:    number
}

/**
 * Returned by GET /api/games/popular?limit=
 * Superset of GameListItem enriched with hero display data.
 * `hero_image_url` is populated from Steam API when FINDX_STEAM_HERO_IMAGES != '0'.
 */
export interface PopularGame extends GameListItem {
  /** Short plain-text blurb for the store hero banner (≤300 chars, HTML stripped) */
  hero_blurb:      string | null
  /** Wide Steam header image URL (460×215) — null if Steam enrichment disabled */
  hero_image_url:  string | null
}

/**
 * Paginated wrapper — GET /api/games and GET /api/search
 *
 * Query params (all optional):
 *   page       number  default 1
 *   limit      number  default 50 (max 200 for /games, 100 for /search)
 *   category   string  filter by category slug
 *   sort       'new' | 'popular'  default 'new'
 *   hasTorrent '0' | '1'  filter to games with/without torrent
 *   q          string  (search only) full-text on title / title_clean
 */
export interface GamesPage {
  total:  number
  page:   number
  limit:  number
  pages:  number
  games:  GameListItem[]
}

/** Single item from GET /api/games/categories */
export interface Category {
  category: string
  count:    number
}

/**
 * GET /api/games/stats
 * Aggregate counts across the entire catalog.
 */
export interface GameStats {
  total:       number
  analyzed:    number
  withTorrent: number
  categories:  Category[]
}

// ── Profile & Playtime ────────────────────────────────────────────────────────

/**
 * GET /api/profile
 * PATCH /api/profile  body: { pseudo?: string }
 */
export interface ProfileResponse {
  pseudo:    string | null
  createdAt: string  // ISO 8601
}

/** Single game entry from GET /api/playtime */
export interface PlaytimeEntry {
  gameId:       string
  totalMs:      number
  sessionCount: number
  lastPlayed:   string | null  // ISO 8601
  gameTitle:    string
}

/**
 * GET /api/playtime         → PlaytimeEntry[]  (sorted by totalMs desc)
 * GET /api/playtime/:gameId → PlaytimeEntry
 * POST /api/playtime/session  body: { gameId: string, durationMs: number }
 */

// ── Download queue (HTTP streaming) ──────────────────────────────────────────

/**
 * In-memory download queue entry.
 * Returned by:
 *   POST /api/downloads        → 201 QueueEntry
 *   GET  /api/downloads        → QueueEntry[]
 *   GET  /api/downloads/:id    → QueueEntry
 *
 * `id` is ephemeral (resets on server restart) — not the DB id.
 * Progress updates are pushed over WebSocket as 'download:progress'.
 */
export interface QueueEntry {
  /** Ephemeral in-process id (resets on restart) */
  id:         number
  gameId:     string
  linkId:     string | null
  /** Resolved URL used for download */
  url:        string
  /** Human-readable link label from scraper */
  text:       string | null
  /** 'torrent' | 'direct-link' | … */
  type:       string
  status:     'queued' | 'downloading' | 'paused' | 'done' | 'failed' | 'cancelled'
  /** 0–1 */
  progress:   number
  speedBps:   number | null
  bytesTotal: number | null
  bytesDone:  number
  /** Absolute path of the downloaded file on the API server */
  outputPath: string | null
  error:      string | null
  /** Date.now() ms timestamp */
  queuedAt:   number
}

// ── Scraping ──────────────────────────────────────────────────────────────────

export type ScrapingPhase = 'listings' | 'analysis' | 'full'

/**
 * GET /api/scraping/status
 * Also pushed as context in the 409 body when a trigger conflicts.
 */
export interface ScrapingStatus {
  running:    boolean
  phase:      ScrapingPhase | null
  /** Current item index during analysis */
  index:      number
  /** Total items to process */
  total:      number
  /** Date.now() ms or null */
  startedAt:  number | null
  finishedAt: number | null
  error:      string | null
}

/**
 * POST /api/scraping/trigger  body: { phase: ScrapingPhase }
 * Returns 409 if scraping is already running.
 */
export interface ScrapingTriggerResponse {
  ok:      boolean
  phase:   ScrapingPhase
  message: string
}

// ── WebSocket push events (/ws) ───────────────────────────────────────────────

/** Wire envelope for all WebSocket messages */
export interface WsEnvelope<E extends string, D> {
  event: E
  data:  D
}

/** Progress snapshot pushed ~every 500ms while downloading */
export interface WsDownloadProgress {
  id:         number
  gameId:     number | undefined
  progress:   number
  speedBps:   number
  bytesTotal: number | null
  bytesDone:  number
}

/** Scraping analysis progress — pushed per-game during deep analysis */
export interface WsScrapingProgress {
  phase: 'analysis'
  index: number
  total: number
}

/** Stats returned after catalog sync that follows a completed scrape */
export interface CatalogUpdateStats {
  total:    number
  analyzed: number
  links:    number
  /** New games added in this sync */
  games?:   number
}

/**
 * Discriminated union of every WebSocket message the server can push.
 *
 * Usage:
 *   const msg = JSON.parse(raw) as WsMessage
 *   if (msg.event === 'download:progress') { ... msg.data.speedBps ... }
 */
export type WsMessage =
  | WsEnvelope<'download:queued',    QueueEntry>
  | WsEnvelope<'download:progress',  WsDownloadProgress>
  | WsEnvelope<'download:complete',  { id: number; outputPath: string }>
  | WsEnvelope<'download:paused',    { id: number }>
  | WsEnvelope<'download:cancelled', { id: number }>
  | WsEnvelope<'download:error',     { id: number; error: string }>
  | WsEnvelope<'scraping:progress',  WsScrapingProgress>
  | WsEnvelope<'scraping:done',      { phase: ScrapingPhase; count?: number }>
  | WsEnvelope<'scraping:error',     { error: string }>
  | WsEnvelope<'catalog:updated',    CatalogUpdateStats>

// ── Misc ──────────────────────────────────────────────────────────────────────

/** GET /health — public, no auth */
export interface HealthResponse {
  ok: boolean
  ts: string  // ISO 8601
}

/** Generic success response used by pause/resume/cancel/stop/view */
export interface OkResponse {
  ok: boolean
}
