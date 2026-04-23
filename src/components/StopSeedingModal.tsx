import { Heart, Users, Zap } from 'lucide-react'

interface Props {
  gameTitle: string
  onKeep:   () => void
  onStop:   () => void
}

const REASONS = [
  { icon: Users, text: 'Chaque seeder rend les téléchargements plus rapides pour tout le monde' },
  { icon: Zap,   text: 'La bande passante utilisée est faible quand personne ne télécharge' },
  { icon: Heart, text: 'C\'est ce qui maintient ce type de réseau en vie à long terme' },
]

export function StopSeedingModal({ gameTitle, onKeep, onStop }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,12,18,0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onKeep() }}
    >
      <div style={{
        width: 440,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--hairline-strong)',
        borderRadius: 18,
        boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 0' }}>
          <h2 style={{
            fontSize: 15, fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0, letterSpacing: '-0.02em',
          }}>
            Arrêter le partage ?
          </h2>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            {gameTitle}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: '0 0 14px' }}>
            Le partage torrent est ce qui fait fonctionner ce réseau. Sans seeders, les nouveaux téléchargeurs n'ont personne à qui parler.
          </p>

          <div style={{ borderTop: '1px solid var(--hairline)' }}>
            {REASONS.map(({ icon: Icon, text }, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 0',
                borderBottom: i < REASONS.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}>
                <Icon size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 24px 20px',
          display: 'flex', gap: 8,
        }}>
          {/* Primary — keep seeding */}
          <button
            type="button"
            onClick={onKeep}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8,
              border: 'none',
              background: '#66c0f4', color: '#0f161e',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#4fa8e0')}
            onMouseLeave={e => (e.currentTarget.style.background = '#66c0f4')}
          >
            Continuer à partager
          </button>

          {/* Secondary — stop */}
          <button
            type="button"
            onClick={onStop}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--hairline-strong)',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            Arrêter quand même
          </button>
        </div>
      </div>
    </div>
  )
}
