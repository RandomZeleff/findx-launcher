export {}

declare global {
  interface Window {
    electron: {
      minimize: () => void
      maximize: () => void
      close:    () => void
      openPath:     (path: string) => Promise<void>
      openGamePath: (path: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
      news: {
        fetchArticleText: (url: string) => Promise<{ ok: boolean; text?: string }>
      }
      getDefaultInstallRoot: () => Promise<string>
      selectInstallFolder:   () => Promise<string | null>
      platform: string
      system: {
        isSteamRunning: () => Promise<boolean>
      }
      game: {
        launch:    (savePath: string, gameTitle: string) => Promise<{ ok: boolean; exePath?: string; error?: string }>
        close:     (savePath: string) => Promise<{ ok: boolean; error?: string }>
        uninstall: (savePath: string) => Promise<{ ok: boolean; error?: string }>
        onExited:  (cb: (data: { savePath: string }) => void) => () => void
      }
      app: {
        getLoginItem: () => Promise<boolean>
        setLoginItem: (enabled: boolean) => Promise<void>
        getVersion:     () => Promise<string>
        isPackaged:     () => Promise<boolean>
        checkForUpdates: () => Promise<{ ok: boolean; error?: string }>
        installUpdate:  () => Promise<void>
        onUpdate: (cb: (payload: {
          type: 'available' | 'progress' | 'ready' | 'error'
          version?: string
          percent?: number
          message?: string
        }) => void) => () => void
      }
      install: {
        extract: (infoHash: string, destPath: string, gameTitle: string, createShortcut?: boolean) => Promise<{ ok: boolean; error?: string; archivePath?: string; exePath?: string | null; shortcutPath?: string | null }>
      }
      torrent: {
        add: (
          source: string | ArrayBuffer,
          installRoot: string,
          gameId: string,
          gameTitle: string,
          createShortcut?: boolean,
        ) => Promise<{ infoHash: string; destPath: string }>
        addFromUrl: (
          torrentUrl: string,
          installRoot: string,
          gameId: string,
          gameTitle: string,
          createShortcut?: boolean,
          requestId?: string | null,
        ) => Promise<{ infoHash: string; destPath: string }>
        cancelAddFromUrl: (requestId: string) => Promise<{ ok: boolean }>
        pause:    (infoHash: string) => Promise<{ ok: boolean }>
        resume:   (infoHash: string) => Promise<{ ok: boolean }>
        remove:   (infoHash: string) => Promise<{ ok: boolean }>
        seed:     (source: string | ArrayBuffer, savePath: string) => Promise<{ ok: boolean; infoHash?: string; error?: string }>
        stopSeed: (infoHash: string) => Promise<{ ok: boolean }>
        onProgress:    (cb: (data: TorrentProgressEvent) => void)   => () => void
        onDone:        (cb: (data: TorrentDoneEvent) => void)       => () => void
        onExtracting:  (cb: (data: TorrentExtractingEvent) => void) => () => void
        onError:       (cb: (data: TorrentErrorEvent) => void)      => () => void
        onSlow?:       (cb: (data: TorrentSlowEvent) => void)       => () => void
        onSeedProgress:     (cb: (data: SeedProgressEvent) => void)               => () => void
        onSeedStopped:      (cb: (data: { infoHash: string }) => void)             => () => void
        onAutoSeedStarted:  (cb: (data: AutoSeedStartedEvent) => void)             => () => void
      }
    }
  }

  interface TorrentProgressEvent {
    infoHash:      string
    progress:      number
    downloadSpeed: number
    downloaded:    number
    length:        number
    timeRemaining: number
    /** Nombre de pairs connectés (vue rapprochée de qBittorrent). */
    numPeers:      number
    /** Débit montant instantané (octets/s). */
    uploadSpeed:   number
  }

  interface TorrentDoneEvent {
    infoHash:      string
    path:          string
    exePath?:      string | null
    shortcutPath?: string | null
  }

  interface TorrentExtractingEvent {
    infoHash: string
  }

  interface TorrentErrorEvent {
    infoHash: string
    error:    string
  }

  interface TorrentSlowEvent {
    infoHash: string
    reason:   string
    numPeers: number
    speed?:   number
  }

  interface SeedProgressEvent {
    infoHash:    string
    uploadSpeed: number
    uploaded:    number
    numPeers:    number
  }

  interface AutoSeedStartedEvent {
    infoHash:  string
    gameId:    string
    gameTitle: string
    savePath:  string
  }
}
