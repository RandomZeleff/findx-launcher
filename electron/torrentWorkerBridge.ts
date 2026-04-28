/**
 * Lance un process Node (ELECTRON_RUN_AS_NODE) pour WebTorrent — le process principal ne fait que relayer IPC + extraction disque.
 */
import { BrowserWindow } from 'electron'
import { fork, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type WorkerOutEvent = { type: 'event'; channel: string; payload: unknown }
type WorkerOutFinalize = {
  type:             'finalizeNeeded'
  finalizeId:       string
  infoHash:         string
  dest:             string
  gameId:           string
  gameTitle:        string
  createShortcut: boolean
}
type WorkerOutReply = { type: 'reply'; id: string; ok: boolean; result?: unknown; error?: string }

type RpcMsg =
  | { type: 'cmd'; id: string; method: string; args?: unknown }
  | { type: 'finalizeDone'; finalizeId: string; ok: boolean }

let child: ChildProcess | null = null
let rpcId = 0
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function workerScriptPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'torrentWorker.js')
}

function broadcast(channel: string, payload: unknown) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, payload)
  }
}

/** Contexte défini depuis main après chargement shell / extraction. */
export interface TorrentFinalizeContext {
  broadcast: typeof broadcast
  findMainArchive: (searchRoot: string) => Promise<string | null>
  runExtraction: (archivePath: string, destDir: string) => Promise<void>
  findGameExe: (dest: string, gameTitle: string) => Promise<string | null>
  createDesktopShortcut: (exePath: string, gameTitle: string) => string | null
}

let ctxRef: TorrentFinalizeContext | null = null

export function registerTorrentFinalizeContext(ctx: TorrentFinalizeContext) {
  ctxRef = ctx
}

function forkWorker(): ChildProcess {
  const script = workerScriptPath()
  const subprocess = fork(script, [], {
    execPath: process.execPath,
    env:      { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio:    ['pipe', 'pipe', 'pipe', 'ipc'],
  })
  subprocess.stderr?.on?.('data', (d: Buffer) => console.error('[torrentWorker]', d.toString()))

  subprocess.on('exit', (code, signal) => {
    child = null
    console.warn('[torrentWorker] exit', code, signal ?? '')
    for (const [, p] of pending) {
      p.reject(new Error(`Worker arrêté (code ${code})`))
    }
    pending.clear()
  })

  subprocess.on('error', err => console.error('[torrentWorker]', err))

  subprocess.on('message', (msg: unknown) => {
    if (!msg || typeof msg !== 'object') return

    const m = msg as WorkerOutReply | WorkerOutEvent | WorkerOutFinalize | { type: string }

    if ('type' in m && m.type === 'reply') {
      const reply = m as WorkerOutReply
      const p = pending.get(reply.id)
      if (!p) return
      pending.delete(reply.id)
      if (reply.ok) p.resolve(reply.result)
      else p.reject(new Error(reply.error ?? 'Erreur inconnue (worker torrent)'))
      return
    }

    if ('type' in m && m.type === 'event') {
      broadcast((m as WorkerOutEvent).channel, (m as WorkerOutEvent).payload)
      return
    }

    if ('type' in m && m.type === 'finalizeNeeded') {
      void handleFinalizeNeeded(m as WorkerOutFinalize).catch(() => { /* erreur envoyée au renderer par handleFinalize */ })
      return
    }
  })

  return subprocess
}

async function handleFinalizeNeeded(m: WorkerOutFinalize): Promise<void> {
  const c = ctxRef
  if (!c) throw new Error('Torrent finalize context not registered')
  const { finalizeId, infoHash, dest, gameTitle, createShortcut } = m

  try {
    const archivePath = await c.findMainArchive(dest)
    if (archivePath) {
      c.broadcast('torrent:extracting', { infoHash })
      try {
        await c.runExtraction(archivePath, dest)
      } catch (extractErr) {
        c.broadcast('torrent:error', {
          infoHash,
          error: `Extraction échouée : ${(extractErr as Error).message}`,
        })
        child?.send({ type: 'finalizeDone', finalizeId, ok: false } satisfies RpcMsg)
        return
      }
    }

    const exePath      = await c.findGameExe(dest, gameTitle)
    const shortcutPath = (createShortcut && exePath) ? c.createDesktopShortcut(exePath, gameTitle) : null

    c.broadcast('torrent:done', {
      infoHash,
      path: dest,
      exePath,
      shortcutPath,
    })
    child?.send({ type: 'finalizeDone', finalizeId, ok: true } satisfies RpcMsg)
  } catch (err) {
    c.broadcast('torrent:error', {
      infoHash,
      error: err instanceof Error ? err.message : String(err),
    })
    child?.send({ type: 'finalizeDone', finalizeId, ok: false } satisfies RpcMsg)
  }
}

function ensureChild(): ChildProcess {
  if (child && !child.killed) return child
  child = forkWorker()
  return child
}

function sendRpc<T>(method: string, args?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `w${++rpcId}`
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    try {
      ensureChild().send({ type: 'cmd', id, method, args } as RpcMsg)
    } catch (e) {
      pending.delete(id)
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

export const torrentWorker = {
  addTorrent(
    source: string | Buffer,
    installRoot: string,
    gameId: string,
    gameTitle: string,
    createShortcut: boolean,
  ) {
    return sendRpc<{ infoHash: string; destPath: string }>('addTorrent', {
      source,
      installRoot,
      gameId,
      gameTitle,
      createShortcut,
    })
  },

  pause(infoHash: string) {
    return sendRpc<{ ok: boolean }>('pause', { infoHash })
  },

  resume(infoHash: string) {
    return sendRpc<{ ok: boolean }>('resume', { infoHash })
  },

  remove(infoHash: string) {
    return sendRpc<{ ok: boolean }>('remove', { infoHash })
  },

  seed(source: string | Buffer, savePath: string) {
    return sendRpc<{ ok: boolean; infoHash?: string; error?: string }>('seed', {
      source,
      savePath,
    })
  },

  stopSeed(infoHash: string) {
    return sendRpc<{ ok: boolean }>('stopSeed', { infoHash })
  },

  kill() {
    if (child && !child.killed) {
      child.kill()
      child = null
    }
  },
}
