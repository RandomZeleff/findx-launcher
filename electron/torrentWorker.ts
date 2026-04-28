/**
 * Processus dédié : WebTorrent uniquement (BitTorrent + vérif disque + préparation extraction).
 * Démarre avec ELECTRON_RUN_AS_NODE via le bridge — mêmes ABI que le lanceur pour utp-native etc.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  buildTorrentProgressPayload,
  flattenSingleSubdir,
  sanitizeGameFolderName,
  waitForTorrentFilesOnDisk,
} from './torrentShared'

interface WtClientLite {
  add: (src: string | Buffer, opts: Record<string, unknown>) => unknown
  get: (infoHash: string) => Promise<unknown>
  remove: (infoHash: string, opts?: { destroyStore?: boolean }) => Promise<void>
}

const _lastProgress: Record<string, number> = {}

type OutEvent = { type: 'event'; channel: string; payload: unknown }
type OutFinalize = {
  type:         'finalizeNeeded'
  finalizeId:   string
  infoHash:     string
  dest:         string
  gameId:       string
  gameTitle:    string
  createShortcut: boolean
}
type OutReply = { type: 'reply'; id: string; ok: boolean; result?: unknown; error?: string }

function emit(ev: OutEvent | OutFinalize) {
  process.send?.(ev)
}

function reply(id: string, ok: boolean, result?: unknown, error?: string) {
  const msg: OutReply = { type: 'reply', id, ok, ...(result !== undefined ? { result } : {}), ...(error !== undefined ? { error } : {}) }
  process.send?.(msg)
}

let _wt: WtClientLite | null = null
async function getClient(): Promise<WtClientLite> {
  if (_wt) return _wt
  const { default: WebTorrent } = await import('webtorrent')
  _wt = new WebTorrent({ maxConns: 120 }) as WtClientLite
  return _wt
}

/** BitTorrent : string (magnet) ou buffer (.torrent) — réutilisé pour auto-seed. */
const _torrentSourceByHash = new Map<string, string | Buffer>()
const _finalizeWaiters = new Map<string, { resolve: (v: boolean) => void }>()
const _seedIntervals = new Map<string, ReturnType<typeof setInterval>>()

async function addTorrentJob(
  client: WtClientLite,
  torrentSource: string | Buffer,
  installRoot: string,
  gameId: string,
  gameTitle: string,
  createShortcut: boolean,
): Promise<{ infoHash: string; destPath: string }> {
  const dest = path.join(installRoot, sanitizeGameFolderName(gameId, gameTitle))

  return (async () => {
    await fs.mkdir(dest, { recursive: true })
    await new Promise<void>((r) => setImmediate(r))

    return new Promise<{ infoHash: string; destPath: string }>((resolve, reject) => {
      const ihKey = (h: string) => {
        _torrentSourceByHash.set(
          h,
          torrentSource instanceof Buffer ? Buffer.from(torrentSource) : torrentSource,
        )
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const torrent: any = client.add(torrentSource, {
        path:              dest,
        storeCacheSlots:   0,
        strategy:          'rarest',
        uploads:           14,
      })

      let doneSent = false
      let finalizeInFlight = false
      let resolved = false
      let watchdog: ReturnType<typeof setInterval> | null = null
      let preReady: ReturnType<typeof setInterval> | null = null

      const clearWatchdog = () => {
        if (watchdog) {
          clearInterval(watchdog)
          watchdog = null
        }
      }

      const clearPreReady = () => {
        if (preReady) {
          clearInterval(preReady)
          preReady = null
        }
      }

      if (torrent.infoHash) {
        ihKey(torrent.infoHash as string)
        resolve({ infoHash: torrent.infoHash as string, destPath: dest })
        resolved = true
      }

      preReady = setInterval(() => {
        if (torrent.destroyed || doneSent) {
          clearPreReady()
          return
        }
        if (torrent.ready) {
          clearPreReady()
          return
        }
        const ih = torrent.infoHash as string | undefined
        if (!ih) return
        emit({ type: 'event', channel: 'torrent:progress', payload: buildTorrentProgressPayload(torrent) })
      }, 2000)

      const finalizeInstall = async () => {
        if (doneSent || finalizeInFlight || torrent.destroyed) return
        const ih = torrent.infoHash as string | undefined
        if (!ih) return

        finalizeInFlight = true
        try {
          const okFiles = await waitForTorrentFilesOnDisk(torrent)
          if (torrent.destroyed) return
          if (!okFiles) {
            emit({
              type:    'event',
              channel: 'torrent:error',
              payload: {
                infoHash: ih,
                error:
                  'Fichiers incorrects sur le disque (0 octet ou taille invalide). ' +
                  'Réessaie ; si le problème continue, télécharge ce torrent avec qBittorrent.',
              },
            })
            return
          }
          doneSent = true
          clearWatchdog()
          try {
            await client.remove(ih, { destroyStore: false })
          } catch { /* ignore */ }
          try { await flattenSingleSubdir(dest) } catch (e) { console.warn('[flatten]', e) }
          await new Promise((r) => setTimeout(r, 800))

          const finalizeId = randomUUID()
          const finalizeOk = await new Promise<boolean>((resolve) => {
            _finalizeWaiters.set(finalizeId, { resolve })
            emit({
              type:             'finalizeNeeded',
              finalizeId,
              infoHash:         ih,
              dest,
              gameId,
              gameTitle,
              createShortcut,
            })
          })

          if (!finalizeOk) return

          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const seedT: any = client.add(
              typeof torrentSource === 'string' ? torrentSource : Buffer.from(torrentSource as Buffer),
              { path: dest, storeCacheSlots: 0 },
            )

            const doAutoSeed = (seedIh: string) => {
              const existing = _seedIntervals.get(seedIh)
              if (existing) clearInterval(existing)
              const interval = setInterval(() => {
                if (seedT.destroyed) {
                  clearInterval(interval)
                  _seedIntervals.delete(seedIh)
                  return
                }
                emit({
                  type:    'event',
                  channel: 'torrent:seedProgress',
                  payload: {
                    infoHash:    seedIh,
                    uploadSpeed: seedT.uploadSpeed ?? 0,
                    uploaded:    seedT.uploaded ?? 0,
                    numPeers:    seedT.numPeers ?? 0,
                  },
                })
              }, 2000)
              _seedIntervals.set(seedIh, interval)
              emit({
                type:    'event',
                channel: 'torrent:autoSeedStarted',
                payload: {
                  infoHash: seedIh, gameId, gameTitle, savePath: dest,
                },
              })
            }

            if (seedT.infoHash) {
              doAutoSeed(seedT.infoHash as string)
            } else {
              seedT.once('ready', () => { if (seedT.infoHash) doAutoSeed(seedT.infoHash as string) })
            }
            seedT.once('error', (e: Error) => console.warn('[auto-seed]', e.message))
          } catch (e) {
            console.warn('[auto-seed] failed', (e as Error).message)
          }
        } finally {
          finalizeInFlight = false
        }
      }

      torrent.once('done', () => { void finalizeInstall() })

      torrent.once('ready', () => {
        clearPreReady()
        if (!resolved) {
          if (torrent.infoHash) ihKey(torrent.infoHash as string)
          resolve({ infoHash: torrent.infoHash as string, destPath: dest })
          resolved = true
        }

        if (torrent.done) void finalizeInstall()

        const STALL_GRACE_MS   = 90_000
        const STALL_TIMEOUT_MS = 180_000
        const MIN_SPEED_BPS    = 50_000
        const readyAt   = Date.now()
        let lastFastAt = Date.now()
        let stallSent  = false

        watchdog = setInterval(() => {
          if (doneSent || torrent.destroyed) {
            clearWatchdog()
            return
          }
          if (torrent.progress >= 0.995 && typeof torrent._checkDone === 'function') {
            torrent._checkDone()
          }
          if (torrent.done && !doneSent && !finalizeInFlight) {
            void finalizeInstall()
          }

          if (!doneSent && !torrent.paused && torrent.infoHash) {
            emit({ type: 'event', channel: 'torrent:progress', payload: buildTorrentProgressPayload(torrent) })
          }

          if (!doneSent && torrent.progress < 0.99) {
            const now = Date.now()
            if (torrent.downloadSpeed >= MIN_SPEED_BPS) {
              lastFastAt = now
              stallSent  = false
            }
            if (!stallSent && (now - readyAt) > STALL_GRACE_MS) {
              if (torrent.numPeers === 0) {
                stallSent = true
                emit({
                  type:    'event',
                  channel: 'torrent:slow',
                  payload: {
                    infoHash: torrent.infoHash,
                    reason:   'no-peers',
                    numPeers: 0,
                    speed:    0,
                  },
                })
              } else if ((now - lastFastAt) > STALL_TIMEOUT_MS) {
                stallSent = true
                emit({
                  type:    'event',
                  channel: 'torrent:slow',
                  payload: {
                    infoHash: torrent.infoHash,
                    reason:   'slow',
                    numPeers: torrent.numPeers,
                    speed:    torrent.downloadSpeed,
                  },
                })
              }
            }
          }
        }, 2000)

        torrent.on('download', () => {
          if (torrent.progress >= 0.999 && typeof torrent._checkDone === 'function') {
            torrent._checkDone()
          }
          const now = Date.now()
          if ((now - (_lastProgress[torrent.infoHash] ?? 0)) < 1000) return
          _lastProgress[torrent.infoHash] = now
          emit({ type: 'event', channel: 'torrent:progress', payload: buildTorrentProgressPayload(torrent) })
        })
      })

      torrent.once('close', () => {
        clearPreReady()
        clearWatchdog()
      })

      torrent.once('error', (err: Error) => {
        clearPreReady()
        clearWatchdog()
        emit({ type: 'event', channel: 'torrent:error', payload: { infoHash: torrent.infoHash ?? 'unknown', error: err.message } })
        if (!resolved) reject(err)
      })
    })
  })()
}

type Cmd =
  | { type: 'cmd'; id: string; method: 'addTorrent'; args: { source: string | Buffer; installRoot: string; gameId: string; gameTitle: string; createShortcut: boolean } }
  | { type: 'cmd'; id: string; method: 'pause'; args: { infoHash: string } }
  | { type: 'cmd'; id: string; method: 'resume'; args: { infoHash: string } }
  | { type: 'cmd'; id: string; method: 'remove'; args: { infoHash: string } }
  | { type: 'cmd'; id: string; method: 'seed'; args: { source: string | Buffer; savePath: string } }
  | { type: 'cmd'; id: string; method: 'stopSeed'; args: { infoHash: string } }

type MainToWorker = Cmd | { type: 'finalizeDone'; finalizeId: string; ok: boolean }

process.on('message', async (msg: MainToWorker) => {
  if (msg.type === 'finalizeDone') {
    const w = _finalizeWaiters.get(msg.finalizeId)
    if (w) {
      _finalizeWaiters.delete(msg.finalizeId)
      w.resolve(msg.ok)
    }
    return
  }

  if (msg.type !== 'cmd') return

  const { id, method } = msg
  try {
    const client = await getClient()
    if (method === 'addTorrent') {
      const { source, installRoot, gameId, gameTitle, createShortcut } = msg.args
      const src = typeof source === 'string' ? source : Buffer.from(source as ArrayBuffer | Buffer)
      const result = await addTorrentJob(client, src, installRoot, gameId, gameTitle, createShortcut)
      reply(id, true, result)
      return
    }
    if (method === 'pause') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = await client.get(msg.args.infoHash) as any
      if (!t) { reply(id, true, { ok: false }); return }
      t.pause()
      reply(id, true, { ok: true })
      return
    }
    if (method === 'resume') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = await client.get(msg.args.infoHash) as any
      if (!t) { reply(id, true, { ok: false }); return }
      t.resume()
      reply(id, true, { ok: true })
      return
    }
    if (method === 'remove') {
      try {
        await client.remove(msg.args.infoHash, { destroyStore: true })
        _torrentSourceByHash.delete(msg.args.infoHash)
        reply(id, true, { ok: true })
      } catch {
        reply(id, true, { ok: false })
      }
      return
    }
    if (method === 'seed') {
      const { source, savePath } = msg.args
      await new Promise<void>((resolve) => {
        let settled = false
        const done = (v: { ok: boolean; infoHash?: string; error?: string }) => {
          if (settled) return
          settled = true
          reply(id, true, v)
          resolve()
        }
        try {
          const seedSrc = typeof source === 'string' ? source : Buffer.from(source as Buffer)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const torrent: any = client.add(seedSrc, {
            path: savePath,
            storeCacheSlots: 0,
          })

          const startInterval = (ih: string) => {
            const existing = _seedIntervals.get(ih)
            if (existing) clearInterval(existing)
            const interval = setInterval(() => {
              if (torrent.destroyed) { clearInterval(interval); _seedIntervals.delete(ih); return }
              emit({
                type:    'event',
                channel: 'torrent:seedProgress',
                payload: {
                  infoHash:    ih,
                  uploadSpeed: torrent.uploadSpeed ?? 0,
                  uploaded:    torrent.uploaded ?? 0,
                  numPeers:    torrent.numPeers ?? 0,
                },
              })
            }, 2000)
            _seedIntervals.set(ih, interval)
          }

          if (torrent.infoHash) {
            done({ ok: true, infoHash: torrent.infoHash as string })
            startInterval(torrent.infoHash as string)
          }

          torrent.once('ready', () => {
            const ih = torrent.infoHash as string
            if (ih && !settled) { done({ ok: true, infoHash: ih }); startInterval(ih) }
          })

          torrent.once('error', (err: Error) => done({ ok: false, error: err.message }))
        } catch (err) {
          done({ ok: false, error: (err as Error).message })
        }
      })
      return
    }
    if (method === 'stopSeed') {
      const interval = _seedIntervals.get(msg.args.infoHash)
      if (interval) { clearInterval(interval); _seedIntervals.delete(msg.args.infoHash) }
      emit({ type: 'event', channel: 'torrent:seedStopped', payload: { infoHash: msg.args.infoHash } })
      try {
        await client.remove(msg.args.infoHash, { destroyStore: false })
        reply(id, true, { ok: true })
      } catch {
        reply(id, true, { ok: false })
      }
      return
    }
    reply(id, false, undefined, `unknown method: ${String(method)}`)
  } catch (e) {
    reply(id, false, undefined, (e as Error).message)
  }
})
