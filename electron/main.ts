import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'url'
import { createRequire } from 'node:module'
import { spawn } from 'child_process'
import type { ChildProcess, SpawnOptions } from 'child_process'
import path from 'path'
import { fetchArticlePlainText } from './articleReader'
import { registerTorrentFinalizeContext, torrentWorker } from './torrentWorkerBridge'

/** Concatène stderr/stdout en ne gardant que la fin — évite de saturer la mémoire et le GC (7-Zip liste des milliers de fichiers). */
const EXTRACT_LOG_TAIL_MAX = 16_384

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

/** Racine par défaut : Documents/FindX/Installations (un sous-dossier par jeu). */
function getDefaultInstallRoot(): string {
  return path.join(app.getPath('documents'), 'FindX', 'Installations')
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

function appendExtractLogTail(acc: { s: string }, chunk: Buffer) {
  acc.s = (acc.s + chunk.toString('utf8')).slice(-EXTRACT_LOG_TAIL_MAX)
}

function runExtractorProcess(bin: string, args: string[], opts?: SpawnOptions): Promise<{ code: number | null; logTail: string }> {
  return new Promise((resolve, reject) => {
    const logTail = { s: '' }
    const proc: ChildProcess = spawn(bin, args, {
      windowsHide: true,
      ...opts,
    })
    proc.stdout?.on('data', (c: Buffer) => appendExtractLogTail(logTail, c))
    proc.stderr?.on('data', (c: Buffer) => appendExtractLogTail(logTail, c))
    proc.once('close', (code) => resolve({ code, logTail: logTail.s.trim() }))
    proc.once('error', reject)
  })
}

async function runExtraction(archivePath: string, destDir: string): Promise<void> {
  const ext = await getExtractor()
  // -bb0 / -bsp0 : moins de sortie console (sinon 7-Zip peut lister chaque fichier → Mo de texte et blocages du process principal).
  const args = ext.type === 'unrar'
    ? [
        'x',
        archivePath,
        destDir + (destDir.endsWith('\\') ? '' : '\\'),
        `-p${ONLINEFIX_PASSWORD}`,
        '-o+',
        '-y',
        '-idq',
      ]
    : ['x', archivePath, `-p${ONLINEFIX_PASSWORD}`, `-o${destDir}`, '-y', '-aoa', '-bb0', '-bsp0']

  console.log('[extract] using', ext.type, ext.bin)
  console.log('[extract] args:', args)

  const { code, logTail } = await runExtractorProcess(ext.bin, args)
  if (logTail && code !== 0) console.log('[extract] tail:', logTail.slice(-800))
  if (code === 0) return
  const detail = logTail.split(/\r?\n/).slice(-8).join(' ').trim()
  throw new Error(`${ext.type} code ${code}${detail ? ` — ${detail}` : ''}`)
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

/** Relais événements torrent (process worker) + extraction (ci-dessous). */
function broadcastTorrentChannel(channel: string, payload: unknown) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, payload)
  }
}

registerTorrentFinalizeContext({
  broadcast: broadcastTorrentChannel,
  findMainArchive,
  runExtraction,
  findGameExe,
  createDesktopShortcut,
})

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
    // Téléchargements / torrent lourds : évite que Chromium ralentisse l’UI quand la fenêtre n’a pas le focus.
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
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

app.on('before-quit', () => {
  torrentWorker.kill()
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

// ── Torrent : processus dédié WebTorrent (voir torrentWorker.ts) ────────────

const _torrentAddFetchAborts = new Map<string, AbortController>()

function resolveInstallRoot(userPath: string): string {
  const t = userPath?.trim()
  return t ? path.resolve(t) : getDefaultInstallRoot()
}

ipcMain.handle(
  'torrent:add',
  async (_e, source: string | ArrayBuffer, installRootUser: string, gameId: string, gameTitle: string, createShortcut = true) => {
    const torrentSource =
      typeof source === 'string' ? source : Buffer.from(source)
    return torrentWorker.addTorrent(torrentSource, resolveInstallRoot(installRootUser), gameId, gameTitle, createShortcut)
  },
)

ipcMain.handle(
  'torrent:addFromUrl',
  async (
    _e,
    torrentUrl: string,
    installRootUser: string,
    gameId: string,
    gameTitle: string,
    createShortcut = true,
    requestId: string | null = null,
  ) => {
    const ac = new AbortController()
    if (requestId) _torrentAddFetchAborts.set(requestId, ac)
    try {
      const res = await fetch(torrentUrl, { signal: ac.signal })
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const j = (await res.json()) as { error?: string }
          if (j?.error) msg = j.error
        } catch {
          msg = res.statusText || msg
        }
        throw new Error(msg)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      return await torrentWorker.addTorrent(buf, resolveInstallRoot(installRootUser), gameId, gameTitle, createShortcut)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        throw err
      }
      throw e
    } finally {
      if (requestId) _torrentAddFetchAborts.delete(requestId)
    }
  },
)

ipcMain.handle('torrent:cancelAddFromUrl', (_e, requestId: string) => {
  _torrentAddFetchAborts.get(requestId)?.abort()
  return { ok: true as const }
})

ipcMain.handle('torrent:pause', async (_e, infoHash: string) => torrentWorker.pause(infoHash))

ipcMain.handle('torrent:resume', async (_e, infoHash: string) => torrentWorker.resume(infoHash))

ipcMain.handle('torrent:remove', async (_e, infoHash: string) => torrentWorker.remove(infoHash))

ipcMain.handle('torrent:seed', async (_e, source: string | ArrayBuffer, savePath: string) => {
  const torrentSource = typeof source === 'string' ? source : Buffer.from(source as ArrayBuffer)
  return torrentWorker.seed(torrentSource, savePath)
})

ipcMain.handle('torrent:stopSeed', async (_e, infoHash: string) => torrentWorker.stopSeed(infoHash))

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
