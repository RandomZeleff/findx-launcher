import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),

  // Shell
  openPath:      (p: string) => ipcRenderer.invoke('shell:openPath', p),
  openGamePath:  (p: string) => ipcRenderer.invoke('shell:openGamePath', p),
  openExternal:  (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  news: {
    fetchArticleText: (url: string) =>
      ipcRenderer.invoke('news:fetchArticleText', url) as Promise<{ ok: boolean; text?: string }>,
  },

  getDefaultInstallRoot: () => ipcRenderer.invoke('app:getDefaultInstallRoot') as Promise<string>,
  selectInstallFolder:   () => ipcRenderer.invoke('dialog:selectInstallFolder') as Promise<string | null>,

  platform: process.platform,

  system: {
    isSteamRunning: () => ipcRenderer.invoke('system:isSteamRunning') as Promise<boolean>,
  },

  game: {
    launch:    (savePath: string, gameTitle: string) =>
      ipcRenderer.invoke('game:launch', savePath, gameTitle) as Promise<{ ok: boolean; exePath?: string; error?: string }>,
    close:     (savePath: string) =>
      ipcRenderer.invoke('game:close', savePath) as Promise<{ ok: boolean; error?: string }>,
    uninstall: (savePath: string) =>
      ipcRenderer.invoke('game:uninstall', savePath) as Promise<{ ok: boolean; error?: string }>,
    onExited: (cb: (data: { savePath: string }) => void) => {
      const handler = (_: unknown, data: { savePath: string }) => cb(data)
      ipcRenderer.on('game:exited', handler)
      return () => ipcRenderer.removeListener('game:exited', handler)
    },
  },

  app: {
    getLoginItem: () => ipcRenderer.invoke('app:getLoginItem') as Promise<boolean>,
    setLoginItem: (enabled: boolean) => ipcRenderer.invoke('app:setLoginItem', enabled) as Promise<void>,

    getVersion:   () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
    isPackaged:   () => ipcRenderer.invoke('app:isPackaged') as Promise<boolean>,
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates') as Promise<{ ok: boolean; error?: string }>,
    installUpdate:  () => ipcRenderer.invoke('app:installUpdate') as Promise<void>,
    onUpdate: (cb: (payload: {
      type: 'available' | 'progress' | 'ready' | 'error'
      version?: string
      percent?: number
      message?: string
    }) => void) => {
      const handler = (_: unknown, p: { type: string; version?: string; percent?: number; message?: string }) => cb(
        p as { type: 'available' | 'progress' | 'ready' | 'error'; version?: string; percent?: number; message?: string }
      )
      ipcRenderer.on('app:update', handler)
      return () => { ipcRenderer.removeListener('app:update', handler) }
    },
  },

  // Install helpers
  install: {
    extract: (infoHash: string, destPath: string, gameTitle: string, createShortcut = true) =>
      ipcRenderer.invoke('install:extract', infoHash, destPath, gameTitle, createShortcut),
  },

  // Torrent management
  torrent: {
    add: (source: string | ArrayBuffer, installRoot: string, gameId: string, gameTitle: string, createShortcut = true) =>
      ipcRenderer.invoke('torrent:add', source, installRoot, gameId, gameTitle, createShortcut),

    addFromUrl: (
      torrentUrl: string,
      installRoot: string,
      gameId: string,
      gameTitle: string,
      createShortcut = true,
      requestId?: string | null,
    ) =>
      ipcRenderer.invoke(
        'torrent:addFromUrl',
        torrentUrl,
        installRoot,
        gameId,
        gameTitle,
        createShortcut,
        requestId ?? null,
      ),

    cancelAddFromUrl: (requestId: string) =>
      ipcRenderer.invoke('torrent:cancelAddFromUrl', requestId) as Promise<{ ok: boolean }>,

    pause: (infoHash: string) =>
      ipcRenderer.invoke('torrent:pause', infoHash),

    resume: (infoHash: string) =>
      ipcRenderer.invoke('torrent:resume', infoHash),

    remove: (infoHash: string) =>
      ipcRenderer.invoke('torrent:remove', infoHash),

    onProgress: (cb: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on('torrent:progress', handler)
      return () => ipcRenderer.removeListener('torrent:progress', handler)
    },

    onDone: (cb: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on('torrent:done', handler)
      return () => ipcRenderer.removeListener('torrent:done', handler)
    },

    onExtracting: (cb: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on('torrent:extracting', handler)
      return () => ipcRenderer.removeListener('torrent:extracting', handler)
    },

    onError: (cb: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on('torrent:error', handler)
      return () => ipcRenderer.removeListener('torrent:error', handler)
    },

    onSlow: (cb: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on('torrent:slow', handler)
      return () => ipcRenderer.removeListener('torrent:slow', handler)
    },

    seed: (source: string | ArrayBuffer, savePath: string) =>
      ipcRenderer.invoke('torrent:seed', source, savePath) as Promise<{ ok: boolean; infoHash?: string; error?: string }>,

    stopSeed: (infoHash: string) =>
      ipcRenderer.invoke('torrent:stopSeed', infoHash) as Promise<{ ok: boolean }>,

    onSeedProgress: (cb: (data: { infoHash: string; uploadSpeed: number; uploaded: number; numPeers: number }) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data as { infoHash: string; uploadSpeed: number; uploaded: number; numPeers: number })
      ipcRenderer.on('torrent:seedProgress', handler)
      return () => ipcRenderer.removeListener('torrent:seedProgress', handler)
    },

    onSeedStopped: (cb: (data: { infoHash: string }) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data as { infoHash: string })
      ipcRenderer.on('torrent:seedStopped', handler)
      return () => ipcRenderer.removeListener('torrent:seedStopped', handler)
    },

    onAutoSeedStarted: (cb: (data: { infoHash: string; gameId: string; gameTitle: string; savePath: string }) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data as { infoHash: string; gameId: string; gameTitle: string; savePath: string })
      ipcRenderer.on('torrent:autoSeedStarted', handler)
      return () => ipcRenderer.removeListener('torrent:autoSeedStarted', handler)
    },
  },
})
