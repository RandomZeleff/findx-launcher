import { useMemo, useState, type ReactNode } from 'react'
import { Library, Download, AlertCircle, HardDrive, Clock, CheckCircle, XCircle, Pencil, Check, X } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import { useApp, type TorrentEntry } from '../context/AppContext'

const ACTIVE_DL = new Set<TorrentEntry['status']>(['connecting', 'downloading', 'paused', 'extracting'])

function formatRelativeFr(ts: number): string {
  const diff = Date.now() - ts
  const sec  = Math.floor(diff / 1000)
  if (sec < 45)  return "à l'instant"
  const min = Math.floor(sec / 60)
  if (min < 60)  return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7)     return `il y a ${d} j`
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatPlaytime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin < 1)  return '< 1 min'
  if (totalMin < 60) return `${totalMin} min`
  const h   = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return min > 0 ? `${h}h ${min}min` : `${h}h`
}

const PRESET_COLORS = ['#66c0f4','#ff6b6b','#ffd93d','#6bcb77','#c77dff','#ff9a3c']

export function Profile() {
  const { profile, updateProfile } = useProfile()
  const { state } = useApp()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [editingColor, setEditingColor] = useState(false)

  const activeDownloads = useMemo(
    () => state.downloads.filter(d => ACTIVE_DL.has(d.status)),
    [state.downloads],
  )
  const failedDownloads = useMemo(
    () => state.downloads.filter(d => d.status === 'failed'),
    [state.downloads],
  )
  const recentInstalls = useMemo(
    () => [...state.installations].sort((a, b) => b.installedAt - a.installedAt).slice(0, 6),
    [state.installations],
  )
  const bytesInFlight = useMemo(
    () => state.downloads
      .filter(d => d.status === 'downloading' && d.length > 0)
      .reduce((acc, d) => acc + d.length, 0),
    [state.downloads],
  )

  const totalPlaytimeMs = useMemo(
    () => Object.values(state.playtime).reduce((acc, p) => acc + p.totalMs, 0),
    [state.playtime],
  )
  const mostPlayed = useMemo(() => {
    const entries = Object.entries(state.playtime)
    if (!entries.length) return null
    const [gameIdStr, record] = entries.reduce((best, cur) => cur[1].totalMs > best[1].totalMs ? cur : best)
    const installation = state.installations.find(i => i.gameId === gameIdStr)
    const gameTitle = record.gameTitle || installation?.gameTitle || gameIdStr
    return { gameTitle, ...record }
  }, [state.playtime, state.installations])

  const recentHistory = useMemo(
    () => state.downloadHistory.slice(0, 8),
    [state.downloadHistory],
  )

  const initial = profile?.username?.[0]?.toUpperCase() ?? '·'

  function startEditName() {
    setNameInput(profile?.username ?? '')
    setEditingName(true)
    setEditingColor(false)
  }

  function saveEditName() {
    const v = nameInput.trim()
    if (v.length >= 2 && v.length <= 24) updateProfile({ username: v })
    setEditingName(false)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl px-10 py-10 space-y-10">

        {/* ── En-tête ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setEditingColor(v => !v)}
            className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-lg font-bold app-no-drag"
            style={{
              background: profile?.avatarColor ? `${profile.avatarColor}22` : 'rgba(102,192,244,0.12)',
              color: profile?.avatarColor ?? 'var(--color-accent)',
              border: `1.5px solid ${profile?.avatarColor ?? '#66c0f4'}44`,
              cursor: 'pointer',
            }}
            title="Changer la couleur"
          >
            {initial}
          </button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditName(); if (e.key === 'Escape') setEditingName(false) }}
                  maxLength={24}
                  className="text-xl font-semibold text-white tracking-tight bg-transparent border-b outline-none"
                  style={{ borderColor: 'var(--color-accent)', width: '180px' }}
                />
                <button type="button" onClick={saveEditName} className="app-no-drag text-green-400 hover:text-green-300">
                  <Check size={15} />
                </button>
                <button type="button" onClick={() => setEditingName(false)} className="app-no-drag text-muted hover:text-white">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-white tracking-tight truncate">
                  {profile?.username ?? 'Profil'}
                </h1>
                <button type="button" onClick={startEditName} className="app-no-drag opacity-40 hover:opacity-100 transition-opacity">
                  <Pencil size={13} />
                </button>
              </div>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Profil local · {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            </p>
          </div>
        </div>

        {/* ── Color picker inline ───────────────────────────────────────────── */}
        {editingColor && (
          <div className="flex items-center gap-3 pl-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { updateProfile({ avatarColor: c }); setEditingColor(false) }}
                className="app-no-drag"
                style={{
                  width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: profile?.avatarColor === c ? '2px solid white' : '2px solid transparent',
                  outline: profile?.avatarColor === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                  transform: profile?.avatarColor === c ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                }}
              />
            ))}
          </div>
        )}

        {/* ── Sur cet appareil ─────────────────────────────────────────────── */}
        <ProfileSection title="Sur cet appareil">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={<Library size={15} />}
              label="Bibliothèque"
              value={String(state.installations.length)}
              hint="titres enregistrés"
              accent
            />
            <MetricCard
              icon={<Download size={15} />}
              label="Téléchargements actifs"
              value={String(activeDownloads.length)}
              hint={bytesInFlight > 0 ? formatBytes(bytesInFlight) + ' en cours' : "file d'attente"}
              accent
            />
            <MetricCard
              icon={<HardDrive size={15} />}
              label="Dossier d'installation"
              value={state.downloadDir ? 'Personnalisé' : 'Par défaut'}
              hint={state.downloadDir ? truncatePath(state.downloadDir) : 'système'}
            />
            <MetricCard
              icon={<AlertCircle size={15} />}
              label="Échecs (session)"
              value={String(failedDownloads.length)}
              hint="cette session seulement"
              warn={failedDownloads.length > 0}
            />
          </div>
        </ProfileSection>

        {/* ── Temps de jeu ─────────────────────────────────────────────────── */}
        {Object.keys(state.playtime).length > 0 && (
          <ProfileSection title="Temps de jeu">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <MetricCard
                icon={<Clock size={15} />}
                label="Total joué"
                value={formatPlaytime(totalPlaytimeMs)}
                hint={`${Object.keys(state.playtime).length} jeu${Object.keys(state.playtime).length > 1 ? 'x' : ''} différent${Object.keys(state.playtime).length > 1 ? 's' : ''}`}
                accent
              />
              {mostPlayed && (
                <MetricCard
                  icon={<Clock size={15} />}
                  label="Plus joué"
                  value={formatPlaytime(mostPlayed.totalMs)}
                  hint={mostPlayed.gameTitle}
                  accent
                />
              )}
            </div>

            {/* Classement des jeux les plus joués */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--hairline-strong)' }}
            >
              {Object.entries(state.playtime)
                .sort(([, a], [, b]) => b.totalMs - a.totalMs)
                .slice(0, 6)
                .map(([gameIdStr, record], i) => {
                  const installation = state.installations.find(inst => inst.gameId === gameIdStr)
                  const title = record.gameTitle || installation?.gameTitle || gameIdStr
                  const pct   = totalPlaytimeMs > 0 ? record.totalMs / totalPlaytimeMs : 0
                  return (
                    <div key={gameIdStr}>
                      {i > 0 && <div style={{ height: 1, background: 'var(--hairline)' }} />}
                      <div className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-[var(--color-text-primary)] truncate min-w-0" title={title}>
                            {title}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] tabular-nums shrink-0">
                            {formatPlaytime(record.totalMs)}
                          </span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(2, pct * 100)}%`, background: 'var(--color-accent)' }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </ProfileSection>
        )}

        {/* ── Récemment installés ───────────────────────────────────────────── */}
        {recentInstalls.length > 0 && (
          <ProfileSection title="Récemment installés">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--hairline-strong)' }}
            >
              {recentInstalls.map((g, i) => (
                <div key={`${g.gameId}-${g.infoHash}`}>
                  {i > 0 && <div style={{ height: 1, background: 'var(--hairline)' }} />}
                  <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--color-text-primary)] truncate min-w-0" title={g.gameTitle}>
                      {g.gameTitle}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums shrink-0">
                      {formatRelativeFr(g.installedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ProfileSection>
        )}

        {/* ── Historique des téléchargements ────────────────────────────────── */}
        {recentHistory.length > 0 && (
          <ProfileSection title="Historique des téléchargements">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--hairline-strong)' }}
            >
              {recentHistory.map((entry, i) => (
                <div key={`${entry.infoHash}-${i}`}>
                  {i > 0 && <div style={{ height: 1, background: 'var(--hairline)' }} />}
                  <div className="px-4 py-2.5 flex items-center gap-3">
                    {entry.status === 'done'
                      ? <CheckCircle size={13} className="shrink-0" style={{ color: 'var(--color-success)' }} />
                      : <XCircle    size={13} className="shrink-0" style={{ color: 'var(--color-error)'   }} />
                    }
                    <span className="text-sm text-[var(--color-text-primary)] truncate flex-1 min-w-0" title={entry.gameTitle}>
                      {entry.gameTitle}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums shrink-0">
                      {formatRelativeFr(entry.finishedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ProfileSection>
        )}

        <p className="text-[11px] text-[var(--color-text-muted)]">findx · Application desktop</p>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          {title}
        </span>
        <div className="flex-1 h-px bg-[var(--hairline)]" />
      </div>
      {children}
    </div>
  )
}


function MetricCard({
  icon, label, value, hint, accent = false, warn = false,
}: {
  icon: ReactNode; label: string; value: string; hint: string; accent?: boolean; warn?: boolean
}) {
  const iconColor = warn ? 'var(--color-warning)' : accent ? 'var(--color-accent)' : 'var(--color-text-muted)'
  return (
    <div
      className="rounded-xl px-4 py-3.5 space-y-2"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--hairline-strong)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: iconColor }}>{icon}</span>
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide truncate">
          {label}
        </span>
      </div>
      <div
        className="text-2xl font-bold tabular-nums"
        style={{ color: warn && Number(value) > 0 ? 'var(--color-warning)' : 'white' }}
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--color-text-muted)] truncate" title={hint}>{hint}</div>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Go`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)} Mo`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)} Ko`
  return `${n} o`
}

function truncatePath(p: string, max = 36): string {
  return p.length <= max ? p : `…${p.slice(-(max - 1))}`
}
