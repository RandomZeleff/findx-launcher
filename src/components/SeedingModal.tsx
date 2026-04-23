import { Upload, Users, WifiOff, AlertTriangle, ExternalLink } from 'lucide-react'

interface Props {
  gameTitle: string
  onConfirm: () => void
  onCancel:  () => void
}

export function SeedingModal({ gameTitle, onConfirm, onCancel }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,12,18,0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        width: 480,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--hairline-strong)',
        borderRadius: 18,
        boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 0',
          display: 'flex', alignItems: 'flex-start', gap: 14,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'rgba(102,192,244,0.08)',
            border: '1px solid rgba(102,192,244,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Upload size={16} style={{ color: '#66c0f4' }} />
          </div>
          <div>
            <h2 style={{
              fontSize: 15, fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0, letterSpacing: '-0.02em',
            }}>
              Partager ce jeu
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
              {gameTitle}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* What it does */}
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
            En activant le partage, tu continues à envoyer les fichiers de ce jeu aux utilisateurs qui le téléchargent.
            Plus il y a de seeders, moins le réseau est ralenti pour tout le monde.
          </p>

          <div style={{ borderTop: '1px solid var(--hairline)' }}>

            {/* Row 1 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--hairline)' }}>
              <Upload size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                  Upload uniquement
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  findx n'utilisera que ta bande passante montante. Rien n'est re-téléchargé.
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--hairline)' }}>
              <Users size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                  Connexions entrantes
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  D'autres utilisateurs pourront se connecter à toi pour récupérer des morceaux du fichier.
                  Le trafic est chiffré et passe par le réseau torrent standard.
                </div>
              </div>
            </div>

            {/* Row 3 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--hairline)' }}>
              <WifiOff size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                  Arrêt à tout moment
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  Un bouton dans la fiche du jeu permet de stopper le partage immédiatement.
                  Le partage s'arrête aussi à la fermeture de l'application.
                </div>
              </div>
            </div>

            {/* Row 4 – warning */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0' }}>
              <AlertTriangle size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Pendant le téléchargement initial, findx partage déjà automatiquement les morceaux reçus
                avec d'autres — c'est le fonctionnement inhérent du P2P. Cette option concerne le partage
                <em> après</em> l'installation.
              </div>
            </div>
          </div>

          {/* External link */}
          <button
            type="button"
            onClick={() => void window.electron.openExternal('https://fr.wikipedia.org/wiki/BitTorrent_(protocole)')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: 11,
              padding: '4px 0 0', textAlign: 'left',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#66c0f4')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            <ExternalLink size={11} />
            En savoir plus sur le protocole BitTorrent
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 24px 20px',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '7px 18px', borderRadius: 8,
              border: '1px solid var(--hairline-strong)',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '7px 20px', borderRadius: 8,
              border: 'none',
              background: '#66c0f4',
              color: '#0f161e',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#4fa8e0')}
            onMouseLeave={e => (e.currentTarget.style.background = '#66c0f4')}
          >
            Activer le partage
          </button>
        </div>
      </div>
    </div>
  )
}
