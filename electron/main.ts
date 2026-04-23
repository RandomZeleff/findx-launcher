import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'url'
import { createRequire } from 'node:module'
import { spawn } from 'child_process'
import path from 'path'
import { fetchArticlePlainText } from './articleReader'

const _require = createRequire(import.meta.url)
/** CJS : import ESM `from 'electron-updater'` casse au runtime (named exports). */
const { autoUpdater } = _require('electron-updater') as typeof import('electron-updater')
const path7za: string = (_require('7zip-bin') as { path7za: string }).path7za
const ONLINEFIX_PASSWORD = 'online-fix.me'

// ── System helpers ────────────────────────────────────────────────────────────

async function isSteamRunningFn(): Promise<boolean> {
  return new Promise(resolve => {
    let out = ''
    const p = spawn('tasklist', ['/FI', 'IMAGENAME eq steam.exe', '/NH', '/FO', 'CSV'], { shell: false })
    p.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    p.once('close', () => resolve(out.toLowerCase().includes('steam.exe')))
    p.once('error', () => resolve(false))
  })
}

// ── Extractor detection ───────────────────────────────────────────────────────
type ExtractorInfo = { type: '7z' | 'unrar'; bin: string }
let _extractor: ExtractorInfo | null = null

async function getExtractor(): Promise<ExtractorInfo> {
  if (_extractor) return _extractor
  const candidates: ExtractorInfo[] = [
    // Full 7-Zip with RAR DLL — best option
    { type: '7z',    bin: 'C:\\Program Files\\7-Zip\\7z.exe' },
    { type: '7z',    bin: 'C:\\Program Files (x86)\\7-Zip\\7z.exe' },
    // WinRAR's UnRAR — native RAR support
    { type: 'unrar', bin: 'C:\\Program Files\\WinRAR\\UnRAR.exe' },
    { type: 'unrar', bin: 'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe' },
  ]
  for (const c of candidates) {
    try {
      await fs.access(c.bin)
      _extractor = c
      console.log('[extractor] using:', c.bin)
      return c
    } catch {
      /* chemin introuvable — essai suivant */
    }
  }
  // Fallback: bundled 7za (limited RAR5 support)
  _extractor = { type: '7z', bin: path7za }
  console.log('[extractor] fallback to bundled 7za:', path7za)
  return _extractor
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let win: BrowserWindow | null = null

// ── WebTorrent client (lazy-loaded) ──────────────────────────────────────────
/** Sous-ensemble du client WebTorrent utilisé dans les handlers IPC. */
interface WtClientLite {
  add: (src: string | Buffer, opts: Record<string, unknown>) => unknown
  get: (infoHash: string) => Promise<unknown>
  remove: (infoHash: string, opts?: { destroyStore?: boolean }) => Promise<void>
}

let _wtClient: WtClientLite | null = null

async function getWtClient(): Promise<WtClientLite> {
  if (_wtClient) return _wtClient
  const { default: WebTorrent } = await import('webtorrent')
  // maxConns ↑ : plus de connexions TCP/uTP simultanées (défaut 55) — utile avec DHT/PEX.
  _wtClient = new WebTorrent({ maxConns: 120 }) as WtClientLite
  return _wtClient
}

// Progress throttle: send at most one event per second per torrent
const _lastProgress: Record<string, number> = {}

/** Snapshot pour l’UI (pairs, débit montant) — aligné sur l’info affichée dans qBittorrent. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTorrentProgressPayload(torrent: any) {
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

/** Racine par défaut : Documents/FindX/Installations (un sous-dossier par jeu). */
function getDefaultInstallRoot(): string {
  return path.join(app.getPath('documents'), 'FindX', 'Installations')
}

function sanitizeGameFolderName(gameId: string, gameTitle: string): string {
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

/** Vérifie que chaque fichier (hors entrées 0 octet) a la bonne taille sur disque — évite « terminé » avec .rar vide. */
async function verifyTorrentFilesOnDisk(torrent: {
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

async function waitForTorrentFilesOnDisk(
  torrent: { destroyed?: boolean; path: string; files: Array<{ path: string; length: number }> },
  attempts = 30,
  delayMs = 250,
): Promise<boolean> {
  for (let a = 0; a < attempts; a++) {
    if (torrent.destroyed) return false
    if (await verifyTorrentFilesOnDisk(torrent)) return true
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return false
}

/**
 * Si dest/ contient un unique sous-dossier (structure typique WebTorrent),
 * remonte son contenu d'un niveau : dest/Sub/file → dest/file
 */
async function flattenSingleSubdir(dest: string): Promise<void> {
  const entries = await fs.readdir(dest, { withFileTypes: true })
  if (entries.length !== 1 || !entries[0].isDirectory()) return
  const subdir = path.join(dest, entries[0].name)
  for (const name of await fs.readdir(subdir)) {
    await fs.rename(path.join(subdir, name), path.join(dest, name))
  }
  try { await fs.rmdir(subdir) } catch { /* ignore if not empty */ }
  console.log('[flatten]', entries[0].name, '->', dest)
}

/** Vérifie les magic bytes pour s'assurer que le fichier est bien une archive valide. */
async function isRealArchive(filePath: string): Promise<boolean> {
  try {
    const handle = await fs.open(filePath, 'r')
    const buf = Buffer.alloc(8)
    await handle.read(buf, 0, 8, 0)
    await handle.close()
    // RAR4 : 52 61 72 21 1A 07 00
    // RAR5 : 52 61 72 21 1A 07 01 00
    const isRar = buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21
               && buf[4] === 0x1A && buf[5] === 0x07
    // ZIP  : 50 4B 03 04
    const isZip = buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03
    // 7z   : 37 7A BC AF 27 1C
    const is7z  = buf[0] === 0x37 && buf[1] === 0x7A && buf[2] === 0xBC && buf[3] === 0xAF
    console.log(`[isRealArchive] ${path.basename(filePath)} — RAR:${isRar} ZIP:${isZip} 7z:${is7z}`)
    return isRar || isZip || is7z
  } catch {
    return false
  }
}

async function findMainArchive(searchRoot: string): Promise<string | null> {
  const dirsToSearch: string[] = [searchRoot]
  try {
    const entries = await fs.readdir(searchRoot, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory()) dirsToSearch.push(path.join(searchRoot, e.name))
    }
  } catch { return null }

  console.log('[findMainArchive] scanning:', dirsToSearch)

  for (const dir of dirsToSearch) {
    let files: string[]
    try { files = await fs.readdir(dir) } catch { continue }

    const archiveFiles = files.filter(f => /\.(rar|zip|7z)$/i.test(f))
    console.log('[findMainArchive] candidates in', dir, ':', archiveFiles)

    // Verify magic bytes — filters out game resource files falsely named .rar/.zip
    const validCandidates: string[] = []
    for (const f of archiveFiles) {
      if (await isRealArchive(path.join(dir, f))) validCandidates.push(f)
    }

    const main =
      validCandidates.find(f => /\.part0*1\.rar$/i.test(f)) ??
      validCandidates.find(f => !/\.part\d+\.rar$/i.test(f) && /\.rar$/i.test(f)) ??
      validCandidates.find(f => /\.(zip|7z)$/i.test(f))

    if (main) {
      const found = path.join(dir, main)
      console.log('[findMainArchive] selected:', found)
      return found
    }
  }

  console.log('[findMainArchive] no valid archive found in', searchRoot)
  return null
}

async function runExtraction(archivePath: string, destDir: string): Promise<void> {
  const ext = await getExtractor()
  const args = ext.type === 'unrar'
    ? ['x', archivePath, destDir + (destDir.endsWith('\\') ? '' : '\\'), `-p${ONLINEFIX_PASSWORD}`, '-o+', '-y']
    : ['x', archivePath, `-p${ONLINEFIX_PASSWORD}`, `-o${destDir}`, '-y', '-aoa']

  console.log('[extract] using', ext.type, ext.bin)
  console.log('[extract] args:', args)

  return new Promise((resolve, reject) => {
    const output: string[] = []
    const proc = spawn(ext.bin, args)
    proc.stdout?.on('data', (c: Buffer) => output.push(c.toString()))
    proc.stderr?.on('data', (c: Buffer) => output.push(c.toString()))
    proc.on('close', (code) => {
      const log = output.join('').trim()
      if (log) console.log('[extract] output:', log)
      if (code === 0) {
        resolve()
      } else {
        const detail = log.split('\n').slice(-6).join(' ').trim()
        reject(new Error(`${ext.type} code ${code}${detail ? ` — ${detail}` : ''}`))
      }
    })
    proc.on('error', reject)
  })
}

// ── Exe finder & desktop shortcut ────────────────────────────────────────────

const EXCLUDED_EXE = /^(unitycrashandler|ue[45]crashreporter|crashreportclient|sentry|setup|install|unins|dxsetup|vcredist|dotnet|physx|oalinst|directx|_commonredist|prereq|redist)/i

async function findGameExe(dest: string, gameTitle: string): Promise<string | null> {
  const dirsToSearch = [dest]
  try {
    for (const e of await fs.readdir(dest, { withFileTypes: true })) {
      if (e.isDirectory()) dirsToSearch.push(path.join(dest, e.name))
    }
  } catch { /* ignore */ }

  const candidates: { p: string; size: number }[] = []
  for (const dir of dirsToSearch) {
    const files = await fs.readdir(dir).catch(() => [] as string[])
    for (const f of files) {
      if (!/\.exe$/i.test(f) || EXCLUDED_EXE.test(f)) continue
      const p = path.join(dir, f)
      const { size } = await fs.stat(p).catch(() => ({ size: 0 }))
      if (size > 0) candidates.push({ p, size })
    }
  }

  if (!candidates.length) return null

  // Prefer exe whose name contains a word from the game title
  const words = gameTitle.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2)
  const byTitle = candidates.find(c => words.some(w => path.basename(c.p).toLowerCase().includes(w)))
  if (byTitle) return byTitle.p

  // Fallback: largest exe
  return candidates.sort((a, b) => b.size - a.size)[0].p
}

function createDesktopShortcut(exePath: string, gameTitle: string): string | null {
  try {
    const desktopPath = app.getPath('desktop')
    const shortcutPath = path.join(desktopPath, `${gameTitle}.lnk`)
    const ok = shell.writeShortcutLink(shortcutPath, 'create', {
      target:      exePath,
      description: gameTitle,
      icon:        exePath,
      iconIndex:   0,
    })
    if (ok) { console.log('[shortcut] created:', shortcutPath); return shortcutPath }
    console.warn('[shortcut] writeShortcutLink returned false')
    return null
  } catch (e) {
    console.warn('[shortcut] error:', e)
    return null
  }
}

// ── Running game registry ─────────────────────────────────────────────────────
// savePath (lowercase normalized) → { child process, exePath, poll timer }
interface RunningEntry {
  child:   ReturnType<typeof spawn>
  exePath: string
  poll:    ReturnType<typeof setInterval> | null
  timeout: ReturnType<typeof setTimeout> | null
}
const runningGames = new Map<string, RunningEntry>()

/**
 * Check whether an exe (by basename) is still listed in tasklist.
 * Used to detect launchers that spawn the real game and then exit.
 */
function isExeStillRunning(exePath: string): Promise<boolean> {
  const exeName = path.basename(exePath)
  return new Promise(resolve => {
    let out = ''
    const p = spawn('tasklist', ['/FI', `IMAGENAME eq ${exeName}`, '/NH', '/FO', 'CSV'], { shell: false })
    p.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    p.once('close', () => resolve(out.toLowerCase().includes(exeName.toLowerCase())))
    p.once('error', () => resolve(false))
  })
}

/**
 * Called once we're confident the game has fully exited.
 * Cleans up timers and notifies the renderer.
 */
function confirmGameExited(key: string, savePath: string) {
  const entry = runningGames.get(key)
  if (entry?.poll)    clearInterval(entry.poll)
  if (entry?.timeout) clearTimeout(entry.timeout)
  runningGames.delete(key)
  win?.webContents.send('game:exited', { savePath })
}

// ── Mises à jour (GitHub Releases, electron-updater) ─────────────────────────
function sendUpdateToRenderer(payload: { type: string; version?: string; percent?: number; message?: string }) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('app:update', payload)
  }
}

/**
 * Cible : releases publiées sur le dépôt `repository` / `build.publish` (fichiers .yml + installateur).
 * En développement (`!app.isPackaged`), ne fait rien.
 */
function initAutoUpdater() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('update-available', info => {
    sendUpdateToRenderer({ type: 'available', version: info.version })
  })
  autoUpdater.on('download-progress', p => {
    sendUpdateToRenderer({ type: 'progress', percent: p.percent })
  })
  autoUpdater.on('update-downloaded', info => {
    sendUpdateToRenderer({ type: 'ready', version: info.version })
  })
  autoUpdater.on('error', err => {
    sendUpdateToRenderer({ type: 'error', message: err.message })
  })

  setTimeout(() => {
    void autoUpdater.checkForUpdates()
  }, 4_000)
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    backgroundColor: '#1b2838',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  initAutoUpdater()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
  win = null
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── Window controls ───────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:maximize', () => {
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.on('window:close', () => win?.close())

// ── Shell helpers ─────────────────────────────────────────────────────────────
ipcMain.handle('shell:openPath', async (_e, filePath: string) => {
  shell.showItemInFolder(filePath)
})

/** Ouvre le dossier / fichier d'installation (explorateur ou exécutable par défaut). */
ipcMain.handle('shell:openGamePath', async (_e, filePath: string) => {
  const err = await shell.openPath(filePath)
  if (err) throw new Error(err)
})

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  const u = String(url).trim()
  if (!/^https?:\/\//i.test(u)) throw new Error('Invalid URL')
  await shell.openExternal(u)
})

/** Extraction du corps d’article (Readability) — hors navigateur, sans CORS renderer. */
ipcMain.handle('news:fetchArticleText', async (_e, url: string) => {
  const u = String(url).trim()
  if (!/^https?:\/\//i.test(u)) return { ok: false as const }
  const text = await fetchArticlePlainText(u)
  if (!text) return { ok: false as const }
  return { ok: true as const, text }
})

ipcMain.handle('app:getDefaultInstallRoot', () => getDefaultInstallRoot())

// ── System IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('system:isSteamRunning', () => isSteamRunningFn())

// ── Game: launch & uninstall ─────────────────────────────────────────────────

ipcMain.handle('game:launch', async (_e, savePath: string, gameTitle: string) => {
  let exePath: string | null = null

  if (/\.exe$/i.test(savePath)) {
    try { await fs.access(savePath); exePath = savePath } catch { /* not a file */ }
  }
  if (!exePath) exePath = await findGameExe(savePath, gameTitle)

  if (!exePath) {
    return { ok: false as const, error: 'Aucun exécutable trouvé dans le dossier d\'installation.' }
  }

  try {
    const child = spawn(exePath, [], {
      detached: true,
      stdio: 'ignore',
      cwd: path.dirname(exePath),
    })
    const key   = path.normalize(savePath).toLowerCase()
    const entry: RunningEntry = { child, exePath, poll: null, timeout: null }
    runningGames.set(key, entry)

    // Poll every 3s regardless of child exit event — detached processes on Windows
    // don't reliably fire 'exit', and many games use a launcher that spawns the real exe.
    // Give the game 4s to appear in tasklist before we start checking for disappearance.
    let pollStarted = false
    const startPoll = () => {
      if (pollStarted) return
      pollStarted = true
      const pollEntry = runningGames.get(key)
      if (!pollEntry) return
      pollEntry.poll = setInterval(async () => {
        if (!(await isExeStillRunning(exePath!))) {
          confirmGameExited(key, savePath)
        }
      }, 3000)
      pollEntry.timeout = setTimeout(() => confirmGameExited(key, savePath), 6 * 60 * 60 * 1000)
    }
    setTimeout(startPoll, 4000)

    // Also watch child exit — for games that exit quickly (no launcher pattern)
    child.once('exit', async () => {
      await new Promise(r => setTimeout(r, 1500))
      if (!(await isExeStillRunning(exePath!))) {
        confirmGameExited(key, savePath)
      } else {
        startPoll()
      }
    })

    child.unref()
    return { ok: true as const, exePath }
  } catch (err) {
    return { ok: false as const, error: (err as Error).message }
  }
})

ipcMain.handle('game:close', (_e, savePath: string) => {
  const key   = path.normalize(savePath).toLowerCase()
  const entry = runningGames.get(key)
  const pid   = entry?.child?.pid
  if (!pid) return { ok: false as const, error: 'Processus introuvable.' }
  try {
    // taskkill /T kills the full process tree, /F forces termination
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { detached: true, stdio: 'ignore' }).unref()
    // Also kill by exe name in case of launcher pattern (real game is a different process)
    const exeName = path.basename(entry.exePath)
    spawn('taskkill', ['/IM', exeName, '/T', '/F'], { detached: true, stdio: 'ignore' }).unref()
    confirmGameExited(key, savePath)
    return { ok: true as const }
  } catch (err) {
    return { ok: false as const, error: (err as Error).message }
  }
})

ipcMain.handle('game:uninstall', async (_e, savePath: string) => {
  try {
    await fs.rm(savePath, { recursive: true, force: true })

    // Scan desktop for .lnk files whose target points inside savePath
    const desktopPath = app.getPath('desktop')
    const normalizedSave = path.normalize(savePath).toLowerCase()
    const files = await fs.readdir(desktopPath).catch(() => [] as string[])
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.lnk')) continue
      const lnkPath = path.join(desktopPath, file)
      try {
        const info = shell.readShortcutLink(lnkPath)
        if (path.normalize(info.target).toLowerCase().startsWith(normalizedSave)) {
          await fs.rm(lnkPath, { force: true })
        }
      } catch { /* unreadable shortcut — skip */ }
    }

    return { ok: true as const }
  } catch (err) {
    return { ok: false as const, error: (err as Error).message }
  }
})

ipcMain.handle('app:getLoginItem', () => app.getLoginItemSettings().openAtLogin)
ipcMain.handle('app:setLoginItem', (_e, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enabled })
})

ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('app:isPackaged', () => app.isPackaged)

ipcMain.handle('app:checkForUpdates', async () => {
  if (!app.isPackaged) return { ok: false as const, error: 'dev' as const }
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('app:installUpdate', () => {
  if (!app.isPackaged) return
  setImmediate(() => { autoUpdater.quitAndInstall(false, true) })
})

ipcMain.handle('dialog:selectInstallFolder', async () => {
  const w = BrowserWindow.getFocusedWindow() ?? win
  if (!w) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(w, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Dossier racine des installations FindX',
  })
  return canceled || !filePaths[0] ? null : filePaths[0]
})

// ── Torrent: add ──────────────────────────────────────────────────────────────
// - storeCacheSlots: 0 → pas de CacheChunkStore (moins de risques d'écritures
//   incomplètes / fichiers à 0 octet sur Windows avec le cache par défaut).
// - Après l'événement `done`, on attend que les tailles sur disque correspondent
//   au métier du torrent avant d'envoyer `torrent:done` au renderer.

ipcMain.handle(
  'torrent:add',
  async (_e, source: string | ArrayBuffer, installRootUser: string, gameId: string, gameTitle: string, createShortcut = true) => {
    const client = await getWtClient()
    // Accept either a magnet URI string or a raw torrent ArrayBuffer
    const torrentSource = typeof source === 'string' ? source : Buffer.from(source)
    const root = installRootUser?.trim()
      ? path.resolve(installRootUser.trim())
      : getDefaultInstallRoot()
    const dest = path.join(root, sanitizeGameFolderName(gameId, gameTitle))
    await fs.mkdir(dest, { recursive: true })

    return new Promise<{ infoHash: string; destPath: string }>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const torrent: any = client.add(torrentSource, {
        path: dest,
        storeCacheSlots: 0,
        // Défaut WebTorrent = sequential : avec peu de seeders, on peut bloquer sur des
        // pièces « en tête » que personne n’a. rarest-first limite ce cas (comportement type qBittorrent).
        strategy: 'rarest',
        // Un peu plus de slots d’upload pour le tit-for-tat (défaut 10).
        uploads: 14,
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

      // For magnet URIs, infoHash is parsed from the URI immediately — no need to
      // wait for the 'ready' event (which only fires after fetching metadata from peers).
      if (torrent.infoHash) {
        resolve({ infoHash: torrent.infoHash as string, destPath: dest })
        resolved = true
      }

      // Pendant l’obtention des métadonnées (magnet / DHT), envoyer le nombre de pairs au renderer.
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
        if (!ih || !win) return
        win.webContents.send('torrent:progress', buildTorrentProgressPayload(torrent))
      }, 2000)

      const finalizeInstall = async () => {
        if (doneSent || finalizeInFlight || torrent.destroyed) return
        const ih = torrent.infoHash as string | undefined
        if (!ih) return

        finalizeInFlight = true
        try {
          const ok = await waitForTorrentFilesOnDisk(torrent, 35, 250)
          if (torrent.destroyed) return
          if (!ok) {
            win?.webContents.send('torrent:error', {
              infoHash: ih,
              error:
                'Fichiers incorrects sur le disque (0 octet ou taille invalide). ' +
                'Réessaie ; si le problème continue, télécharge ce torrent avec qBittorrent.',
            })
            return
          }
          // Mark done BEFORE remove so watchdog doesn't re-fire
          doneSent = true
          clearWatchdog()
          // Remove from client (destroyStore:false = keep files) to close all
          // file handles on Windows — without this the ZIP stays locked/corrupt
          try {
            await client.remove(ih, { destroyStore: false })
          } catch { /* ignore */ }
          // Flatten dest/SubFolder/* → dest/* so archives are at the root level
          try { await flattenSingleSubdir(dest) } catch (e) { console.warn('[flatten] error:', e) }
          // Let Windows fully flush & release handles before extractor opens the archive
          await new Promise(r => setTimeout(r, 800))

          // Auto-extract the password-protected archive
          const archivePath = await findMainArchive(dest)
          if (archivePath) {
            win?.webContents.send('torrent:extracting', { infoHash: ih })
            try {
              await runExtraction(archivePath, dest)
            } catch (extractErr) {
              win?.webContents.send('torrent:error', {
                infoHash: ih,
                error:    `Extraction échouée : ${(extractErr as Error).message}`,
              })
              return
            }
          }

          // Find main exe and create desktop shortcut
          const exePath      = await findGameExe(dest, gameTitle)
          const shortcutPath = (createShortcut && exePath) ? createDesktopShortcut(exePath, gameTitle) : null

          win?.webContents.send('torrent:done', {
            infoHash: ih,
            path:     dest,
            exePath,
            shortcutPath,
          })

          // Auto-start seeding after install (default behaviour).
          // Re-add the same torrent source; WebTorrent verifies pieces on disk
          // and immediately becomes a seeder — no re-download needed.
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API dynamique WebTorrent
            const seedT: any = client.add(torrentSource, { path: dest, storeCacheSlots: 0 })

            const doAutoSeed = (seedIh: string) => {
              const existing = _seedIntervals.get(seedIh)
              if (existing) clearInterval(existing)
              const interval = setInterval(() => {
                if (seedT.destroyed) { clearInterval(interval); _seedIntervals.delete(seedIh); return }
                win?.webContents.send('torrent:seedProgress', {
                  infoHash:    seedIh,
                  uploadSpeed: seedT.uploadSpeed ?? 0,
                  uploaded:    seedT.uploaded    ?? 0,
                  numPeers:    seedT.numPeers    ?? 0,
                })
              }, 2000)
              _seedIntervals.set(seedIh, interval)
              win?.webContents.send('torrent:autoSeedStarted', {
                infoHash: seedIh, gameId, gameTitle, savePath: dest,
              })
            }

            if (seedT.infoHash) {
              doAutoSeed(seedT.infoHash as string)
            } else {
              seedT.once('ready', () => { if (seedT.infoHash) doAutoSeed(seedT.infoHash as string) })
            }
            seedT.once('error', (e: Error) => console.warn('[auto-seed] error:', e.message))
          } catch (e) {
            console.warn('[auto-seed] failed to re-add torrent:', (e as Error).message)
          }
        } finally {
          finalizeInFlight = false
        }
      }

      torrent.once('done', () => {
        void finalizeInstall()
      })

      torrent.once('ready', () => {
        clearPreReady()
        // Fallback resolve for .torrent buffers that didn't have infoHash before ready
        if (!resolved) {
          resolve({ infoHash: torrent.infoHash as string, destPath: dest })
          resolved = true
        }

        if (torrent.done) void finalizeInstall()

        // Stall detection state
        const STALL_GRACE_MS   = 90_000  // wait 90s after ready before checking
        const STALL_TIMEOUT_MS = 180_000 // 3min under threshold = stalled
        const MIN_SPEED_BPS    = 50_000  // 50 KB/s — below this counts as "slow"
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

          // Rafraîchir pairs / débits pour l’UI (même si peu d’événements `download`).
          if (!doneSent && !torrent.paused && torrent.infoHash && win) {
            win.webContents.send('torrent:progress', buildTorrentProgressPayload(torrent))
          }

          // Stall detection — only while actively downloading (progress < 99%)
          if (!doneSent && torrent.progress < 0.99) {
            const now = Date.now()
            // Reset stallSent if speed has recovered — allows re-alerting if it drops again
            if (torrent.downloadSpeed >= MIN_SPEED_BPS) {
              lastFastAt = now
              stallSent  = false
            }
            if (!stallSent && (now - readyAt) > STALL_GRACE_MS) {
              if (torrent.numPeers === 0) {
                stallSent = true
                win?.webContents.send('torrent:slow', {
                  infoHash: torrent.infoHash,
                  reason:   'no-peers',
                  numPeers: 0,
                  speed:    0,
                })
              } else if ((now - lastFastAt) > STALL_TIMEOUT_MS) {
                stallSent = true
                win?.webContents.send('torrent:slow', {
                  infoHash: torrent.infoHash,
                  reason:   'slow',
                  numPeers: torrent.numPeers,
                  speed:    torrent.downloadSpeed,
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
          win?.webContents.send('torrent:progress', buildTorrentProgressPayload(torrent))
        })
      })

      torrent.once('close', () => {
        clearPreReady()
        clearWatchdog()
      })

      torrent.once('error', (err: Error) => {
        clearPreReady()
        clearWatchdog()
        win?.webContents.send('torrent:error', {
          infoHash: torrent.infoHash ?? 'unknown',
          error:    err.message,
        })
        // If we already resolved (magnet path), propagate via event — can't reject twice
        if (!resolved) reject(err)
      })
    })
  },
)

// ── Torrent: pause / resume / remove ─────────────────────────────────────────
// WebTorrent v2 : `client.get()` est async (Promise<Torrent | null>).

ipcMain.handle('torrent:pause', async (_e, infoHash: string) => {
  const client = await getWtClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const torrent = await client.get(infoHash) as any
  if (!torrent) return { ok: false }
  torrent.pause()
  return { ok: true }
})

ipcMain.handle('torrent:resume', async (_e, infoHash: string) => {
  const client = await getWtClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const torrent = await client.get(infoHash) as any
  if (!torrent) return { ok: false }
  torrent.resume()
  return { ok: true }
})

ipcMain.handle('torrent:remove', async (_e, infoHash: string) => {
  const client = await getWtClient()
  try {
    // destroyStore : supprime les fichiers partiels (annulation d'installation)
    await client.remove(infoHash, { destroyStore: true })
    return { ok: true }
  } catch {
    return { ok: false }
  }
})

// ── Torrent: seed (partage après installation) ────────────────────────────────
// Ré-ajoute un torrent installé en mode seed-only : WebTorrent vérifie les
// pièces sur disque et commence à partager sans re-télécharger.

const _seedIntervals = new Map<string, ReturnType<typeof setInterval>>()

ipcMain.handle(
  'torrent:seed',
  async (_e, source: string | ArrayBuffer, savePath: string) => {
    const client = await getWtClient()
    const torrentSource = typeof source === 'string' ? source : Buffer.from(source)

    return new Promise<{ ok: boolean; infoHash?: string; error?: string }>((resolve) => {
      let resolved = false
      const done = (v: { ok: boolean; infoHash?: string; error?: string }) => {
        if (!resolved) { resolved = true; resolve(v) }
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API dynamique WebTorrent
        const torrent: any = client.add(torrentSource, {
          path: savePath,
          storeCacheSlots: 0,
        })

        const startInterval = (ih: string) => {
          const existing = _seedIntervals.get(ih)
          if (existing) clearInterval(existing)
          const interval = setInterval(() => {
            if (torrent.destroyed) { clearInterval(interval); _seedIntervals.delete(ih); return }
            win?.webContents.send('torrent:seedProgress', {
              infoHash:    ih,
              uploadSpeed: torrent.uploadSpeed ?? 0,
              uploaded:    torrent.uploaded    ?? 0,
              numPeers:    torrent.numPeers    ?? 0,
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
          if (ih) { done({ ok: true, infoHash: ih }); startInterval(ih) }
        })

        torrent.once('error', (err: Error) => done({ ok: false, error: err.message }))
      } catch (err) {
        done({ ok: false, error: (err as Error).message })
      }
    })
  },
)

ipcMain.handle('torrent:stopSeed', async (_e, infoHash: string) => {
  const interval = _seedIntervals.get(infoHash)
  if (interval) { clearInterval(interval); _seedIntervals.delete(infoHash) }
  win?.webContents.send('torrent:seedStopped', { infoHash })
  const client = await getWtClient()
  try {
    await client.remove(infoHash, { destroyStore: false })
    return { ok: true }
  } catch { return { ok: false } }
})

// ── Manual extraction (retry after failed or already-downloaded torrent) ──────
ipcMain.handle('install:extract', async (_e, infoHash: string, destPath: string, gameTitle: string, createShortcut = true) => {
  win?.webContents.send('torrent:extracting', { infoHash })
  const archivePath = await findMainArchive(destPath)
  if (!archivePath) {
    const error = `Aucune archive valide trouvée dans : ${destPath} — le jeu est peut-être déjà extrait.`
    win?.webContents.send('torrent:error', { infoHash, error })
    return { ok: false, error }
  }
  try {
    await runExtraction(archivePath, destPath)
    const exePath      = await findGameExe(destPath, gameTitle)
    const shortcutPath = (createShortcut && exePath) ? createDesktopShortcut(exePath, gameTitle) : null
    win?.webContents.send('torrent:done', { infoHash, path: destPath, exePath, shortcutPath })
    return { ok: true, archivePath, exePath, shortcutPath }
  } catch (err) {
    const error = (err as Error).message
    win?.webContents.send('torrent:error', { infoHash, error })
    return { ok: false, error }
  }
})
