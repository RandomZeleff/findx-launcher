import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../api/client'
import { getBoolPref, PREF_NOTIFICATIONS, PREF_AUTO_SEED } from '../lib/preferences'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TorrentEntry {
  infoHash:      string
  gameId:        string
  gameTitle:     string
  status:        'connecting' | 'downloading' | 'stalled' | 'paused' | 'extracting' | 'done' | 'failed'
  progress:      number
  downloadSpeed: number
  downloaded:    number
  length:        number
  timeRemaining: number
  /** Pairs connectés (mise à jour depuis le processus principal). */
  numPeers?:     number
  uploadSpeed?:  number
  savePath:      string | null
  error:         string | null
  startedAt:     number
}

export interface InstalledGame {
  gameId:        string
  gameTitle:     string
  savePath:      string | null
  infoHash:      string
  installedAt:   number
  exePath:       string | null
  shortcutPath:  string | null
}

export interface PlaytimeRecord {
  totalMs:      number
  lastPlayedAt: number | null
  sessionCount: number
  gameTitle?:   string
}

export interface SeedEntry {
  infoHash:    string
  gameId:      string
  gameTitle:   string
  savePath:    string
  uploadSpeed: number
  uploaded:    number
  numPeers:    number
  startedAt:   number
}

export interface DownloadHistoryEntry {
  gameId:      string
  gameTitle:   string
  infoHash:    string
  status:      'done' | 'failed'
  startedAt:   number
  finishedAt:  number
  error?:      string | null
}

const INSTALL_STORAGE_KEY  = 'findx_installations_v1'
const PLAYTIME_STORAGE_KEY = 'findx_playtime_v1'
const DLHIST_STORAGE_KEY   = 'findx_dl_history_v1'

function loadStoredInstallations(): InstalledGame[] {
  try {
    const raw = localStorage.getItem(INSTALL_STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data
      .filter(
        (x): x is InstalledGame =>
          Boolean(x) &&
          typeof x === 'object' &&
          typeof (x as InstalledGame).gameId === 'string' &&
          typeof (x as InstalledGame).gameTitle === 'string' &&
          typeof (x as InstalledGame).infoHash === 'string',
      )
      .map(x => ({
        ...x,
        exePath:      x.exePath ?? null,
        shortcutPath: x.shortcutPath ?? null,
      }))
  } catch { return [] }
}

function loadStoredPlaytime(): Record<number, PlaytimeRecord> {
  try {
    const raw = localStorage.getItem(PLAYTIME_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<number, PlaytimeRecord>
  } catch { return {} }
}

function loadStoredDownloadHistory(): DownloadHistoryEntry[] {
  try {
    const raw = localStorage.getItem(DLHIST_STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
  } catch { return [] }
}

function persistInstallations(list: InstalledGame[]) {
  try { localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(list)) } catch { /* quota */ }
}
function persistPlaytime(map: Record<number, PlaytimeRecord>) {
  try { localStorage.setItem(PLAYTIME_STORAGE_KEY, JSON.stringify(map)) } catch { /* quota */ }
}
function persistDownloadHistory(list: DownloadHistoryEntry[]) {
  try { localStorage.setItem(DLHIST_STORAGE_KEY, JSON.stringify(list)) } catch { /* quota */ }
}

// ── State ─────────────────────────────────────────────────────────────────────

interface AppState {
  apiConnected:    boolean
  steamRunning:    boolean
  downloads:       TorrentEntry[]
  downloadDir:     string
  installations:   InstalledGame[]
  runningGames:    string[]
  playtime:        Record<string, PlaytimeRecord>
  downloadHistory: DownloadHistoryEntry[]
  seeds:           SeedEntry[]
}

function buildInitialState(): AppState {
  return {
    apiConnected:    false,
    steamRunning:    false,
    downloads:       [],
    runningGames:    [],
    downloadDir:     localStorage.getItem('findx_download_dir') || '',
    installations:   loadStoredInstallations(),
    playtime:        loadStoredPlaytime(),
    downloadHistory: loadStoredDownloadHistory(),
    seeds:           [],
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_API_CONNECTED'; payload: boolean }
  | { type: 'SET_STEAM_RUNNING'; payload: boolean }
  | { type: 'GAME_LAUNCHED';     payload: string }
  | { type: 'GAME_EXITED';       payload: string }
  | { type: 'ADD_TORRENT';       payload: TorrentEntry }
  | { type: 'UPDATE_TORRENT';    payload: Partial<TorrentEntry> & { infoHash: string } }
  | { type: 'REMOVE_TORRENT';    payload: string }
  | { type: 'REMOVE_INSTALLATION'; payload: string }
  | { type: 'CLEAR_ALL_INSTALLATIONS' }
  | { type: 'SET_DOWNLOAD_DIR';  payload: string }
  | { type: 'TORRENT_DONE';      payload: { infoHash: string; path: string; exePath?: string | null; shortcutPath?: string | null } }
  | { type: 'RECORD_PLAYTIME';   payload: { gameId: string; durationMs: number; lastPlayedAt: number; gameTitle: string } }
  | { type: 'ADD_DOWNLOAD_HISTORY'; payload: DownloadHistoryEntry }
  | { type: 'ADD_SEED';    payload: SeedEntry }
  | { type: 'UPDATE_SEED'; payload: Partial<SeedEntry> & { infoHash: string } }
  | { type: 'REMOVE_SEED'; payload: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_API_CONNECTED':
      return { ...state, apiConnected: action.payload }

    case 'SET_STEAM_RUNNING':
      return { ...state, steamRunning: action.payload }

    case 'GAME_LAUNCHED':
      if (state.runningGames.includes(action.payload)) return state
      return { ...state, runningGames: [...state.runningGames, action.payload] }

    case 'GAME_EXITED':
      return { ...state, runningGames: state.runningGames.filter(p => p !== action.payload) }

    case 'ADD_TORRENT':
      if (state.downloads.find(d => d.infoHash === action.payload.infoHash)) return state
      return { ...state, downloads: [action.payload, ...state.downloads] }

    case 'UPDATE_TORRENT':
      return {
        ...state,
        downloads: state.downloads.map(d =>
          d.infoHash === action.payload.infoHash ? { ...d, ...action.payload } : d
        ),
      }

    case 'REMOVE_TORRENT':
      return { ...state, downloads: state.downloads.filter(d => d.infoHash !== action.payload) }

    case 'REMOVE_INSTALLATION': {
      const installations = state.installations.filter(i => i.gameId !== action.payload)
      persistInstallations(installations)
      return { ...state, installations }
    }

    case 'CLEAR_ALL_INSTALLATIONS':
      persistInstallations([])
      return { ...state, installations: [] }

    case 'SET_DOWNLOAD_DIR':
      return { ...state, downloadDir: action.payload }

    case 'TORRENT_DONE': {
      const { infoHash, path, exePath = null, shortcutPath = null } = action.payload
      const entry = state.downloads.find(d => d.infoHash === infoHash)
      let installations = state.installations
      if (entry) {
        const rec: InstalledGame = {
          gameId:       entry.gameId,
          gameTitle:    entry.gameTitle,
          savePath:     path,
          infoHash,
          installedAt:  Date.now(),
          exePath:      exePath ?? null,
          shortcutPath: shortcutPath ?? null,
        }
        const rest = state.installations.filter(i => i.gameId !== rec.gameId)
        installations = [rec, ...rest]
        persistInstallations(installations)
      }
      return {
        ...state,
        installations,
        downloads: state.downloads.map(d =>
          d.infoHash === infoHash ? { ...d, status: 'done', progress: 1, savePath: path } : d
        ),
      }
    }

    case 'RECORD_PLAYTIME': {
      const { gameId, durationMs, lastPlayedAt, gameTitle } = action.payload
      const existing = state.playtime[gameId] ?? { totalMs: 0, lastPlayedAt: 0, sessionCount: 0 }
      const updated = {
        ...state.playtime,
        [gameId]: {
          totalMs:      existing.totalMs + durationMs,
          lastPlayedAt,
          sessionCount: existing.sessionCount + 1,
          gameTitle:    gameTitle || existing.gameTitle,
        },
      }
      persistPlaytime(updated)
      return { ...state, playtime: updated }
    }

    case 'ADD_DOWNLOAD_HISTORY': {
      const history = [action.payload, ...state.downloadHistory].slice(0, 50)
      persistDownloadHistory(history)
      return { ...state, downloadHistory: history }
    }

    case 'ADD_SEED':
      if (state.seeds.find(s => s.infoHash === action.payload.infoHash)) return state
      return { ...state, seeds: [action.payload, ...state.seeds] }

    case 'UPDATE_SEED':
      return {
        ...state,
        seeds: state.seeds.map(s =>
          s.infoHash === action.payload.infoHash ? { ...s, ...action.payload } : s
        ),
      }

    case 'REMOVE_SEED':
      return { ...state, seeds: state.seeds.filter(s => s.infoHash !== action.payload) }

    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

export type AppDispatch = React.Dispatch<Action>

interface AppContextValue {
  state:    AppState
  dispatch: AppDispatch
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, () => buildInitialState())
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Tracks session start times keyed by savePath
  const sessionStartsRef = useRef<Record<string, number>>({})
  // Tracks download start times keyed by infoHash
  const dlStartsRef      = useRef<Record<string, number>>({})
  // Set of paused infoHashes — O(1) lookup in the onProgress hot path
  const pausedHashesRef  = useRef<Set<string>>(new Set())

  // Enhanced dispatch: intercepts actions to maintain side-channel refs
  const dispatch = useCallback((action: Action) => {
    if (action.type === 'ADD_TORRENT') {
      dlStartsRef.current[action.payload.infoHash] = Date.now()
    }
    if (action.type === 'GAME_LAUNCHED') {
      sessionStartsRef.current[action.payload] = Date.now()
    }
    if (action.type === 'UPDATE_TORRENT') {
      if (action.payload.status === 'paused') {
        pausedHashesRef.current.add(action.payload.infoHash)
      } else if (action.payload.status != null) {
        pausedHashesRef.current.delete(action.payload.infoHash)
      }
    }
    if (action.type === 'REMOVE_TORRENT') {
      pausedHashesRef.current.delete(action.payload)
    }
    rawDispatch(action)
  }, [])

  // ── Steam running polling ─────────────────────────────────────────────────
  useEffect(() => {
    async function checkSteam() {
      try {
        const running = await (window.electron as Window['electron'] | undefined)?.system?.isSteamRunning?.() ?? false
        dispatch({ type: 'SET_STEAM_RUNNING', payload: running })
      } catch { /* ignore */ }
    }
    checkSteam()
    const id = setInterval(checkSteam, 30_000)
    return () => clearInterval(id)
  }, [dispatch])

  // ── API health polling ─────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        await apiFetch<unknown>('/health')
        dispatch({ type: 'SET_API_CONNECTED', payload: true })
      } catch {
        dispatch({ type: 'SET_API_CONNECTED', payload: false })
      }
    }
    init()
    const id = setInterval(async () => {
      try {
        await apiFetch<unknown>('/health')
        dispatch({ type: 'SET_API_CONNECTED', payload: true })
      } catch {
        dispatch({ type: 'SET_API_CONNECTED', payload: false })
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [dispatch])

  // ── WebTorrent IPC listeners ───────────────────────────────────────────────
  useEffect(() => {
    const torrent = (window as Window & { electron?: typeof window.electron }).electron?.torrent
    if (!torrent) return

    const offProgress = torrent.onProgress((ev) => {
      const prev = stateRef.current.downloads.find(d => d.infoHash === ev.infoHash)
      if (prev?.status === 'extracting' || prev?.status === 'done' || prev?.status === 'failed') return

      if (pausedHashesRef.current.has(ev.infoHash)) {
        dispatch({
          type: 'UPDATE_TORRENT',
          payload: {
            infoHash:    ev.infoHash,
            numPeers:    ev.numPeers,
            uploadSpeed: ev.uploadSpeed,
          },
        })
        return
      }

      if (prev?.status === 'stalled') {
        dispatch({
          type: 'UPDATE_TORRENT',
          payload: {
            infoHash:        ev.infoHash,
            progress:        ev.progress,
            downloadSpeed:   ev.downloadSpeed,
            downloaded:      ev.downloaded,
            length:          ev.length,
            timeRemaining:   ev.timeRemaining,
            numPeers:        ev.numPeers,
            uploadSpeed:     ev.uploadSpeed,
          },
        })
        return
      }

      const hasMeta = ev.length > 0 && Number.isFinite(ev.length)
      const stayConnecting =
        prev?.status === 'connecting' && !hasMeta && (ev.progress ?? 0) < 0.0001
      dispatch({
        type: 'UPDATE_TORRENT',
        payload: {
          infoHash:      ev.infoHash,
          status:        stayConnecting ? 'connecting' : 'downloading',
          progress:      ev.progress,
          downloadSpeed: ev.downloadSpeed,
          downloaded:    ev.downloaded,
          length:        ev.length,
          timeRemaining: ev.timeRemaining,
          numPeers:      ev.numPeers,
          uploadSpeed:   ev.uploadSpeed,
        },
      })
    })

    const offDone = torrent.onDone((ev) => {
      const entry = stateRef.current.downloads.find(d => d.infoHash === ev.infoHash)
      dispatch({ type: 'TORRENT_DONE', payload: { infoHash: ev.infoHash, path: ev.path, exePath: ev.exePath, shortcutPath: ev.shortcutPath } })
      if (entry) {
        dispatch({
          type: 'ADD_DOWNLOAD_HISTORY',
          payload: {
            gameId:     entry.gameId,
            gameTitle:  entry.gameTitle,
            infoHash:   ev.infoHash,
            status:     'done',
            startedAt:  dlStartsRef.current[ev.infoHash] ?? entry.startedAt ?? Date.now(),
            finishedAt: Date.now(),
          },
        })
        delete dlStartsRef.current[ev.infoHash]
        if (getBoolPref(PREF_NOTIFICATIONS, true)) {
          try {
            new Notification('findx', { body: `${entry.gameTitle} installé avec succès !`, silent: true })
          } catch { /* blocked */ }
        }
      }
    })

    const offExtracting = torrent.onExtracting((ev) => {
      dispatch({ type: 'UPDATE_TORRENT', payload: { infoHash: ev.infoHash, status: 'extracting' } })
    })

    const offSlow = torrent.onSlow?.((ev) => {
      const { infoHash, reason, numPeers } = ev
      // Only mark stalled if still actively waiting (not done/failed/paused)
      const entry = stateRef.current.downloads.find(d => d.infoHash === infoHash)
      if (entry && (entry.status === 'connecting' || entry.status === 'downloading')) {
        const msg = reason === 'no-peers'
          ? 'Aucun seeder disponible — le jeu sera téléchargé dès qu\'un pair sera disponible.'
          : `Débit très faible (${numPeers} pair${numPeers > 1 ? 's' : ''}) — connexion lente ou peu de seeders.`
        dispatch({
          type: 'UPDATE_TORRENT',
          payload: { infoHash, status: 'stalled', error: msg, numPeers },
        })
      }
    })

    const offError = torrent.onError((ev) => {
      const entry = stateRef.current.downloads.find(d => d.infoHash === ev.infoHash)
      dispatch({ type: 'UPDATE_TORRENT', payload: { infoHash: ev.infoHash, status: 'failed', error: ev.error } })
      if (entry) {
        dispatch({
          type: 'ADD_DOWNLOAD_HISTORY',
          payload: {
            gameId:     entry.gameId,
            gameTitle:  entry.gameTitle,
            infoHash:   ev.infoHash,
            status:     'failed',
            startedAt:  dlStartsRef.current[ev.infoHash] ?? entry.startedAt ?? Date.now(),
            finishedAt: Date.now(),
            error:      ev.error,
          },
        })
        delete dlStartsRef.current[ev.infoHash]
      }
    })

    return () => { offProgress(); offDone(); offExtracting(); offSlow?.(); offError() }
  }, [dispatch])

  // ── Seed IPC listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const torrent = (window as Window & { electron?: typeof window.electron }).electron?.torrent
    if (!torrent) return

    const offSeedProgress = torrent.onSeedProgress((ev) => {
      dispatch({
        type: 'UPDATE_SEED',
        payload: {
          infoHash:    ev.infoHash,
          uploadSpeed: ev.uploadSpeed,
          uploaded:    ev.uploaded,
          numPeers:    ev.numPeers,
        },
      })
    })

    const offSeedStopped = torrent.onSeedStopped((ev) => {
      dispatch({ type: 'REMOVE_SEED', payload: ev.infoHash })
    })

    const offAutoSeed = torrent.onAutoSeedStarted((ev) => {
      dispatch({
        type: 'ADD_SEED',
        payload: {
          infoHash:    ev.infoHash,
          gameId:      ev.gameId,
          gameTitle:   ev.gameTitle,
          savePath:    ev.savePath,
          uploadSpeed: 0,
          uploaded:    0,
          numPeers:    0,
          startedAt:   Date.now(),
        },
      })
    })

    return () => { offSeedProgress(); offSeedStopped(); offAutoSeed() }
  }, [dispatch])

  // ── Auto-restart seeding on app start ─────────────────────────────────────
  // For each installed game not in the opt-out list, re-seed using its infoHash.
  const seedRestartedRef = useRef(false)
  useEffect(() => {
    const torrent = (window as Window & { electron?: typeof window.electron }).electron?.torrent
    if (!torrent || !state.apiConnected || state.installations.length === 0 || seedRestartedRef.current) return
    if (!getBoolPref(PREF_AUTO_SEED, true)) return
    seedRestartedRef.current = true

    let disabled: Set<string>
    try { disabled = new Set(JSON.parse(localStorage.getItem('findx_seeding_disabled') ?? '[]')) }
    catch { disabled = new Set() }

    for (const inst of state.installations) {
      if (!inst.savePath || !inst.infoHash || disabled.has(inst.gameId)) continue
      // Skip if already seeding (from the current session)
      if (stateRef.current.seeds.find(s => s.gameId === inst.gameId)) continue

      const magnet = `magnet:?xt=urn:btih:${inst.infoHash}&dn=${encodeURIComponent(inst.gameTitle)}`
      void torrent.seed(magnet, inst.savePath)
        .then(result => {
          if (result.ok && result.infoHash) {
            dispatch({
              type: 'ADD_SEED',
              payload: {
                infoHash:    result.infoHash,
                gameId:      inst.gameId,
                gameTitle:   inst.gameTitle,
                savePath:    inst.savePath!,
                uploadSpeed: 0, uploaded: 0, numPeers: 0,
                startedAt:   Date.now(),
              },
            })
          }
        })
        .catch(() => {})
    }
  }, [state.apiConnected, state.installations, dispatch])

  // ── Game process lifecycle + playtime tracking ────────────────────────────
  useEffect(() => {
    const offExited = window.electron?.game?.onExited?.(({ savePath }) => {
      const startedAt = sessionStartsRef.current[savePath]
      delete sessionStartsRef.current[savePath]

      if (startedAt) {
        const durationMs = Date.now() - startedAt
        const installation = stateRef.current.installations.find(i => i.savePath === savePath)
        if (installation && durationMs > 5_000) {
          dispatch({
            type: 'RECORD_PLAYTIME',
            payload: { gameId: installation.gameId, durationMs, lastPlayedAt: Date.now(), gameTitle: installation.gameTitle },
          })
          void apiFetch('/api/playtime/session', {
            method: 'POST',
            body: JSON.stringify({ gameId: installation.gameId, durationMs }),
          }).catch(() => {})
        }
      }

      dispatch({ type: 'GAME_EXITED', payload: savePath })
    })
    return () => offExited?.()
  }, [dispatch])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
