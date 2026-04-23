import { useState, type FormEvent } from 'react'
import { useProfile } from '../context/ProfileContext'

const PRESET_COLORS = [
  '#66c0f4',
  '#ff6b6b',
  '#ffd93d',
  '#6bcb77',
  '#c77dff',
  '#ff9a3c',
]

export function ProfileSetup() {
  const { setupProfile } = useProfile()
  const [username, setUsername] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (name.length < 2) { setError('Le pseudo doit contenir au moins 2 caractères.'); return }
    if (name.length > 24) { setError('Le pseudo ne peut pas dépasser 24 caractères.'); return }
    setupProfile(name, color)
  }

  return (
    <div
      className="flex items-center justify-center h-screen"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div
        className="w-full max-w-sm px-8 py-10 rounded-2xl space-y-8"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--hairline-strong)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div className="text-center space-y-1">
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#66c0f4' }}>
            findx
          </div>
          <h1 className="text-lg font-semibold text-white mt-3">Bienvenue</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Choisis ton pseudo pour commencer
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Pseudo
            </label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(null) }}
              autoFocus
              maxLength={24}
              placeholder="ex: Shadow, Player1…"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: 'var(--color-bg-hover)',
                border: '1px solid var(--hairline-strong)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Couleur du profil
            </label>
            <div className="flex gap-3">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? `2px solid white` : '2px solid transparent',
                    outline: color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ color: 'var(--color-error)', background: 'var(--color-error-subtle)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
            style={{
              background: color,
              color: '#0f161e',
            }}
          >
            Commencer
          </button>
        </form>
      </div>
    </div>
  )
}
