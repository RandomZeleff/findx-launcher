import { useState, useEffect } from 'react'
import { FolderOpen, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { StopSeedingModal } from '../components/StopSeedingModal'
import {
  initialLibraryCompactGrid,
  initialAutoShortcut,
  initialNotifications,
  initialAutoSeed,
  PREF_LIBRARY_COMPACT_GRID,
  PREF_AUTO_SHORTCUT,
  PREF_NOTIFICATIONS,
  PREF_AUTO_SEED,
  setBoolPref,
} from '../lib/preferences'

export function Settings() {
  const { state, dispatch } = useApp()

  const [downloadDir, setDownloadDir]               = useState(state.downloadDir)
  const [defaultInstallRoot, setDefaultInstallRoot] = useState<string>('')
  const [saved, setSaved]                           = useState(false)
  const [compactGrid, setCompactGridState]          = useState(initialLibraryCompactGrid)
  const [autoShortcut, setAutoShortcutState]        = useState(initialAutoShortcut)
  const [loginItem, setLoginItemState]              = useState(false)
  const [notifications, setNotificationsState]      = useState(initialNotifications)
  const [autoSeed, setAutoSeedState]                = useState(initialAutoSeed)
  const [stopSeedConfirm, setStopSeedConfirm]       = useState(false)

  useEffect(() => {
    setDownloadDir(localStorage.getItem('findx_download_dir') || '')
    void window.electron.getDefaultInstallRoot().then(setDefaultInstallRoot).catch(() => {})
    void window.electron.app.getLoginItem().then(setLoginItemState).catch(() => {})
  }, [])

  function saveInstallPath() {
    localStorage.setItem('findx_download_dir', downloadDir)
    dispatch({ type: 'SET_DOWNLOAD_DIR', payload: downloadDir })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function setCompact(v: boolean) {
    setCompactGridState(v)
    setBoolPref(PREF_LIBRARY_COMPACT_GRID, v)
  }

  function setAutoShortcut(v: boolean) {
    setAutoShortcutState(v)
    setBoolPref(PREF_AUTO_SHORTCUT, v)
  }

  function setNotifications(v: boolean) {
    setNotificationsState(v)
    setBoolPref(PREF_NOTIFICATIONS, v)
    if (v && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }

  function setLoginItem(v: boolean) {
    setLoginItemState(v)
    void window.electron.app.setLoginItem(v).catch(() => {})
  }

  function handleAutoSeedToggle(v: boolean) {
    if (!v) {
      // Intercepte la désactivation → modal de confirmation
      setStopSeedConfirm(true)
    } else {
      setAutoSeedState(true)
      setBoolPref(PREF_AUTO_SEED, true)
    }
  }

  async function confirmDisableSeed() {
    setStopSeedConfirm(false)
    setAutoSeedState(false)
    setBoolPref(PREF_AUTO_SEED, false)
    for (const s of state.seeds) {
      await window.electron.torrent.stopSeed(s.infoHash).catch(() => {})
      dispatch({ type: 'REMOVE_SEED', payload: s.infoHash })
    }
  }

  function clearLibraryEntries() {
    const n = state.installations.length
    if (n === 0) return
    const ok = window.confirm(
      `Retirer les ${n} jeu${n > 1 ? 'x' : ''} enregistré${n > 1 ? 's' : ''} dans la bibliothèque ?\n\n`
      + 'Les fichiers sur le disque ne seront pas supprimés ; seule la liste dans findx sera réinitialisée.',
    )
    if (!ok) return
    dispatch({ type: 'CLEAR_ALL_INSTALLATIONS' })
  }

  const openInstallFolder = () => {
    const path = downloadDir.trim() || defaultInstallRoot
    if (!path) return
    void window.electron.openPath(path)
  }

  const seedSummary = state.seeds.length > 0
    ? `${state.seeds.length} jeu${state.seeds.length > 1 ? 'x' : ''} actuellement partagé${state.seeds.length > 1 ? 's' : ''}`
    : 'partage automatique activé'

  return (
    <>
    {stopSeedConfirm && (
      <StopSeedingModal
        gameTitle={seedSummary}
        onKeep={() => setStopSeedConfirm(false)}
        onStop={() => void confirmDisableSeed()}
      />
    )}
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl px-10 py-10 space-y-10">

        <h1 className="text-xl font-semibold text-white tracking-tight">Paramètres</h1>

        {/* ── Application ───────────────────────────────────────────────────── */}
        <Section title="Application">
          <ToggleRow
            label="Lancer au démarrage de Windows"
            description="findx démarre automatiquement à l'ouverture de session."
            checked={loginItem}
            onChange={setLoginItem}
          />
          <ToggleRow
            label="Notifications d'installation"
            description="Une notification système apparaît quand un jeu finit de s'installer."
            checked={notifications}
            onChange={setNotifications}
          />
        </Section>

        {/* ── Affichage ─────────────────────────────────────────────────────── */}
        <Section title="Affichage">
          <ToggleRow
            label="Grille compacte"
            description="Réduit la taille des tuiles dans la bibliothèque pour afficher plus de jeux à l'écran."
            checked={compactGrid}
            onChange={setCompact}
          />
        </Section>

        {/* ── Téléchargements ───────────────────────────────────────────────── */}
        <Section title="Téléchargements">
          <ToggleRow
            label="Raccourci bureau automatique"
            description="Crée un raccourci .lnk sur le bureau à la fin de chaque installation."
            checked={autoShortcut}
            onChange={setAutoShortcut}
          />

          <div className="pt-1 pb-0.5">
            <div className="text-sm font-medium text-white mb-0.5">Dossier d'installation</div>
            <div className="text-xs text-[var(--color-text-muted)] mb-3">
              {defaultInstallRoot
                ? `Par défaut : ${defaultInstallRoot}\\[id]-[nom du jeu]\\`
                : 'Chaque jeu est installé dans son propre sous-dossier.'}
            </div>
            <div className="flex gap-2">
              <input
                value={downloadDir}
                onChange={e => setDownloadDir(e.target.value)}
                placeholder={defaultInstallRoot || 'Chemin personnalisé…'}
                className="flex-1 min-w-0 rounded-md text-sm text-[var(--color-text-primary)]
                           placeholder:text-[var(--color-text-muted)] px-3 py-2
                           bg-[var(--color-bg-surface)] border border-[var(--hairline-strong)]
                           focus:outline-none focus:border-[var(--color-accent-dim)] transition-colors"
              />
              <button
                type="button"
                onClick={async () => {
                  const p = await window.electron.selectInstallFolder()
                  if (p) setDownloadDir(p)
                }}
                className="shrink-0 px-3 py-2 text-xs text-[var(--color-text-muted)]
                           bg-[var(--color-bg-surface)] border border-[var(--hairline-strong)]
                           rounded-md hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-light)]
                           transition-colors whitespace-nowrap app-no-drag"
              >
                Parcourir…
              </button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <button
                type="button"
                onClick={openInstallFolder}
                disabled={!downloadDir.trim() && !defaultInstallRoot}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-muted)]
                           bg-[var(--color-bg-surface)] border border-[var(--hairline-strong)] rounded-md
                           hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-light)]
                           transition-colors disabled:opacity-40 disabled:pointer-events-none app-no-drag"
              >
                <FolderOpen size={13} className="shrink-0" />
                Ouvrir le dossier
              </button>
              <button
                type="button"
                onClick={saveInstallPath}
                className="px-4 py-1.5 text-xs font-semibold rounded-md
                           bg-[var(--color-accent)] text-[#1b2838]
                           hover:bg-[var(--color-accent-hover)] transition-colors app-no-drag"
              >
                {saved ? 'Enregistré ✓' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </Section>

        {/* ── Réseau ────────────────────────────────────────────────────────── */}
        <Section title="Réseau">
          <ToggleRow
            label="Partage automatique (seeding)"
            description="Partage automatiquement les jeux installés avec les autres utilisateurs. Désactiver cette option stoppe immédiatement tous les partages en cours."
            checked={autoSeed}
            onChange={handleAutoSeedToggle}
          />
          {autoSeed && state.seeds.length > 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {state.seeds.length} jeu{state.seeds.length > 1 ? 'x' : ''} actuellement partagé{state.seeds.length > 1 ? 's' : ''}.
            </p>
          )}
        </Section>

        {/* ── Données locales ───────────────────────────────────────────────── */}
        <Section title="Données locales">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Bibliothèque</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {state.installations.length === 0
                  ? 'Aucun jeu enregistré.'
                  : `${state.installations.length} titre${state.installations.length > 1 ? 's' : ''} enregistré${state.installations.length > 1 ? 's' : ''}`}
              </div>
            </div>
            <button
              type="button"
              onClick={clearLibraryEntries}
              disabled={state.installations.length === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold
                         bg-[var(--color-error-subtle)] text-[var(--color-error)]
                         hover:bg-[var(--color-error-subtle-hover)] transition-colors
                         disabled:opacity-30 disabled:pointer-events-none app-no-drag"
            >
              <Trash2 size={13} strokeWidth={2} />
              Vider
            </button>
          </div>
        </Section>

        <p className="text-[11px] text-[var(--color-text-muted)]">findx · Application desktop</p>

      </div>
    </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          {title}
        </span>
        <div className="flex-1 h-px bg-[var(--hairline)]" />
      </div>
      <div className="space-y-5">
        {children}
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  hint,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-6 ${disabled ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        {description && (
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{description}</div>
        )}
        {hint && <div className="text-xs text-[var(--color-text-muted)] mt-0.5 italic">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className="shrink-0 app-no-drag"
      >
        <span
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-150
            ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-surface)] border border-[var(--hairline-strong)]'}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150
              ${checked ? 'translate-x-4' : 'translate-x-0.5'} ${!checked ? 'opacity-40' : ''}`}
          />
        </span>
      </button>
    </div>
  )
}
