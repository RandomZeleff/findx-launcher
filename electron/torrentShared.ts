/**
 * Helpers partagés (main ≠ worker Electron) — WebTorrent hors du process principal.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

export function sanitizeGameFolderName(gameId: string, gameTitle: string): string {
  const raw = (`${gameId}-${gameTitle}`).trim() || `game-${gameId}`
  const illegal = new Set(Array.from('<>:"/\\|?*'))
  const safe = [...raw]
    .map(ch => {
      const cp = ch.codePointAt(0) ?? 0
      return cp < 0x20 || illegal.has(ch) ? '_' : ch
    })
    .join('')
    .replace(/\.+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
  return safe || `game-${gameId}`
}

export async function verifyTorrentFilesOnDisk(torrent: {
  destroyed?: boolean
  path: string
  files: Array<{ path: string; length: number }>
}): Promise<boolean> {
  if (!torrent.files?.length) return true
  for (const f of torrent.files) {
    if (f.length === 0) continue
    const fullPath = path.join(torrent.path, f.path)
    let st: Awaited<ReturnType<typeof fs.stat>>
    try {
      st = await fs.stat(fullPath)
    } catch {
      return false
    }
    if (st.size !== f.length) return false
  }
  return true
}

export async function waitForTorrentFilesOnDisk(
  torrent: { destroyed?: boolean; path: string; files: Array<{ path: string; length: number }> },
  attempts = 35,
  delayMs = 250,
): Promise<boolean> {
  for (let a = 0; a < attempts; a++) {
    if (torrent.destroyed) return false
    if (await verifyTorrentFilesOnDisk(torrent)) return true
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return false
}

export async function flattenSingleSubdir(dest: string): Promise<void> {
  const entries = await fs.readdir(dest, { withFileTypes: true })
  if (entries.length !== 1 || !entries[0].isDirectory()) return
  const subdir = path.join(dest, entries[0].name)
  for (const name of await fs.readdir(subdir)) {
    await fs.rename(path.join(subdir, name), path.join(dest, name))
  }
  try { await fs.rmdir(subdir) } catch { /* ignore */ }
}

/** Snapshot torrent pour l’UI — aligné sur l’usage dans main avant worker. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTorrentProgressPayload(torrent: any) {
  const wiresLen = Array.isArray(torrent.wires) ? torrent.wires.length : 0
  const numPeers =
    typeof torrent.numPeers === 'number' && !Number.isNaN(torrent.numPeers)
      ? torrent.numPeers
      : wiresLen
  return {
    infoHash:      torrent.infoHash as string,
    progress:      torrent.progress ?? 0,
    downloadSpeed: torrent.downloadSpeed ?? 0,
    downloaded:    torrent.downloaded ?? 0,
    length:        torrent.length ?? 0,
    timeRemaining: torrent.timeRemaining ?? 0,
    numPeers,
    uploadSpeed:   torrent.uploadSpeed ?? 0,
  }
}
