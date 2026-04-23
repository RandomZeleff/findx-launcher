import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Sparkles, LayoutGrid, Network, AlertCircle, Gamepad2,
  Library, ShoppingBag, ScrollText, User, Settings,
  Upload, Check, ExternalLink,
} from 'lucide-react'

// ─── Steam SVG ────────────────────────────────────────────────────────────────
function SteamIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.494 1.409-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
    </svg>
  )
}

// ─── P2P mesh diagram ─────────────────────────────────────────────────────────
// Montre que tout le monde échange avec tout le monde — pas de serveur central.
function P2PDiagram() {
  // Positions (viewBox 0 0 380 160)
  // Toi: center (190, 80) — highlighted
  // S1: top-left  (52, 28)
  // S2: top-right (328, 28)
  // P1: bot-left  (52, 132)
  // P2: bot-right (328, 132)
  const cx = 190, cy = 80
  const nodes = [
    { x: 52,  y: 28,  label: 'Seeder', sub: '' },
    { x: 328, y: 28,  label: 'Seeder', sub: '' },
    { x: 52,  y: 132, label: 'Pair',   sub: '' },
    { x: 328, y: 132, label: 'Pair',   sub: '' },
  ]
  // All edges: Toi ↔ each outer node + cross edges between outer nodes
  const edges: [number, number, number, number][] = [
    // Toi to each outer
    [cx, cy, nodes[0].x, nodes[0].y],
    [cx, cy, nodes[1].x, nodes[1].y],
    [cx, cy, nodes[2].x, nodes[2].y],
    [cx, cy, nodes[3].x, nodes[3].y],
    // Cross between outers (mesh feel)
    [nodes[0].x, nodes[0].y, nodes[1].x, nodes[1].y],
    [nodes[2].x, nodes[2].y, nodes[3].x, nodes[3].y],
    [nodes[0].x, nodes[0].y, nodes[2].x, nodes[2].y],
    [nodes[1].x, nodes[1].y, nodes[3].x, nodes[3].y],
  ]

  return (
    <div style={{ margin: '18px 0 4px' }}>
      <svg
        viewBox="0 0 380 160"
        fill="none"
        style={{ width: '100%', display: 'block' }}
        aria-hidden
      >
        {/* Outer-to-outer edges (dimmer) */}
        {edges.slice(4).map(([x1, y1, x2, y2], i) => (
          <line
            key={`cross-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(199,213,224,0.06)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}
        {/* Toi-to-outer edges */}
        {edges.slice(0, 4).map(([x1, y1, x2, y2], i) => (
          <line
            key={`main-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(199,213,224,0.14)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ))}

        {/* Outer nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r="19" fill="rgba(255,255,255,0.02)" stroke="rgba(199,213,224,0.1)" strokeWidth="1" />
            <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize="9.5" fontWeight="500" fill="rgba(199,213,224,0.45)"
              fontFamily="Inter,system-ui,sans-serif">
              {n.label}
            </text>
          </g>
        ))}

        {/* Toi — accent */}
        <circle cx={cx} cy={cy} r="24" fill="rgba(102,192,244,0.07)" stroke="rgba(102,192,244,0.35)" strokeWidth="1.5" />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fontWeight="700" fill="#66c0f4"
          fontFamily="Inter,system-ui,sans-serif">
          Toi
        </text>

        {/* Bidirectional arrows on Toi edges — small tick marks mid-edge */}
        {edges.slice(0, 4).map(([x1, y1, x2, y2], i) => {
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          return (
            <text key={`arr-${i}`} x={mx} y={my + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill="rgba(199,213,224,0.2)"
              fontFamily="system-ui">
              ⇄
            </text>
          )
        })}
      </svg>

      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.55, marginTop: 4 }}>
        Il n'y a pas de serveur central. Chaque utilisateur échange directement avec les autres —
        seeders et pairs téléchargent et partagent en même temps.
      </p>
    </div>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────
const TABS = [
  { icon: Library,     label: 'Bibliothèque', desc: 'Tes jeux téléchargés, leur état et progression' },
  { icon: ShoppingBag, label: 'Magasin',       desc: 'Parcourir et lancer le téléchargement' },
  { icon: ScrollText,  label: 'Changelog',     desc: 'Nouveautés et mises à jour du catalogue' },
  { icon: User,        label: 'Profil',        desc: 'Ton compte, pseudo et couleur' },
  { icon: Settings,    label: 'Paramètres',    desc: "Options de l'application" },
]

// ─── Row helper ───────────────────────────────────────────────────────────────
function Row({ icon: Icon, label, description, last = false }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string; description: string; last?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <Icon size={13} style={{ color: 'var(--color-text-muted)', marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{description}</div>
      </div>
    </div>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────
type StepDef = { Icon: LucideIcon; title: string; subtitle: string; content: ReactNode }

function buildSteps(): StepDef[] {
  return [
    // 1 – Bienvenue
    {
      Icon: Sparkles,
      title: 'Bienvenue sur findx',
      subtitle: 'Quelques informations avant de commencer',
      content: (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>
            findx te permet de télécharger et jouer à des jeux multijoueur gratuitement.
            Le catalogue regroupe plus de 1&nbsp;800 jeux issus de Online&#8209;Fix, mis à jour régulièrement.
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: '12px 0 0' }}>
            Ce guide t'explique comment fonctionne l'application en quelques étapes.
          </p>
        </div>
      ),
    },

    // 2 – Les onglets
    {
      Icon: LayoutGrid,
      title: "Les sections de l'application",
      subtitle: 'Ce que tu trouveras dans chaque onglet',
      content: (
        <div style={{ marginTop: 8 }}>
          {TABS.map((t, i) => (
            <Row key={t.label} icon={t.icon} label={t.label} description={t.desc} last={i === TABS.length - 1} />
          ))}
        </div>
      ),
    },

    // 3 – Réseau P2P
    {
      Icon: Network,
      title: 'Le réseau P2P (torrent)',
      subtitle: 'Comment les fichiers circulent entre utilisateurs',
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>
            findx utilise le protocole <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>BitTorrent</span>.
            Les fichiers ne viennent pas d'un serveur — ils sont distribués entre tous les utilisateurs simultanément.
          </p>
          <P2PDiagram />
          <button
            type="button"
            onClick={() => void window.electron?.openExternal('https://fr.wikipedia.org/wiki/BitTorrent_(protocole)')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: 11,
              padding: 0, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#66c0f4')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            <ExternalLink size={11} />
            En savoir plus sur le protocole BitTorrent
          </button>
        </div>
      ),
    },

    // 4 – Partager / seeder
    {
      Icon: Upload,
      title: 'Contribuer au réseau',
      subtitle: 'Pendant le téléchargement et après',
      content: (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
            Pendant un téléchargement, findx partage automatiquement les morceaux déjà reçus avec d'autres pairs.
            C'est le fonctionnement normal du P2P — c'est minimal et aide la communauté.
          </p>
          <div style={{ borderTop: '1px solid var(--hairline)' }}>
            {[
              {
                label: 'Seeder un jeu installé',
                desc:  "Une fois le jeu installé, tu peux activer le partage depuis sa fiche dans la Bibliothèque. findx partagera le jeu avec les nouveaux téléchargeurs.",
              },
              {
                label: 'Données réseau en temps réel',
                desc:  'Vitesse d\'upload, pairs connectés et volume partagé sont affichés directement dans la fiche du jeu.',
              },
              {
                label: 'Arrêt à tout moment',
                desc:  'Le partage s\'arrête au clic ou à la fermeture de l\'application. Aucun fond de tâche persistent.',
              },
            ].map((item, i, arr) => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  border: '1px solid rgba(102,192,244,0.3)',
                  background: 'rgba(102,192,244,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={9} style={{ color: '#66c0f4' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // 5 – Téléchargement bloqué
    {
      Icon: AlertCircle,
      title: 'Téléchargement bloqué à 0% ?',
      subtitle: 'Cause et solutions',
      content: (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
            Si un jeu reste bloqué, il n'y a pas assez de seeders actifs en ce moment.
            Ce n'est pas un bug — c'est temporaire. Plus les joueurs partagent les jeux qu'ils ont, moins ça arrive.
          </p>
          <div style={{ borderTop: '1px solid var(--hairline)' }}>
            {[
              'Réessaie quelques heures plus tard',
              'Choisis un jeu plus populaire — plus de seeders',
              'Laisse le téléchargement ouvert, il reprend automatiquement',
            ].map((text, i, arr) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-text-muted)', flexShrink: 0, opacity: 0.5 }} />
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // 6 – Steam
    {
      Icon: Gamepad2,
      title: 'Steam requis pour jouer en ligne',
      subtitle: 'Les jeux utilisent online-fix.me pour le multijoueur',
      content: (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
            Pour que le multijoueur fonctionne, Steam doit être{' '}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>ouvert et connecté</span>{' '}
            sur ton PC avant de lancer un jeu.
          </p>
          <div style={{ borderTop: '1px solid var(--hairline)' }}>
            {[
              'Steam est installé sur ton PC',
              'Tu es connecté à un compte Steam',
              'Steam est ouvert avant de lancer le jeu',
            ].map((text, i, arr) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: '1px solid rgba(102,192,244,0.3)',
                  background: 'rgba(102,192,244,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={9} style={{ color: '#66c0f4' }} />
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--color-text-muted)',
          }}>
            <SteamIcon size={13} />
            <span style={{ fontSize: 12 }}>Un compte Steam gratuit suffit — pas besoin d'achats.</span>
          </div>
        </div>
      ),
    },
  ]
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const steps = buildSteps()
  const { Icon, title, subtitle, content } = steps[step]
  const isLast = step === steps.length - 1

  function finish() {
    localStorage.setItem('findx_onboarding_done', '1')
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(8,12,18,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 8888,
    }}>
      <div style={{
        width: 500,
        maxHeight: '90vh',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--hairline-strong)',
        borderRadius: 18,
        boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '13px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--hairline)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 800, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#66c0f4',
          }}>
            findx
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {step + 1} / {steps.length}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 16px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(102,192,244,0.07)',
              border: '1px solid rgba(102,192,244,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={16} style={{ color: '#66c0f4' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)',
                margin: 0, letterSpacing: '-0.02em',
              }}>
                {title}
              </h2>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
                {subtitle}
              </p>
            </div>
          </div>
          {content}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 28px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid var(--hairline)',
          flexShrink: 0,
        }}>
          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                height: 5,
                width: i === step ? 18 : 5,
                borderRadius: 3,
                background: i === step
                  ? '#66c0f4'
                  : i < step ? 'rgba(102,192,244,0.3)' : 'var(--hairline-strong)',
                transition: 'width 0.2s ease, background 0.2s ease',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: '7px 16px', borderRadius: 7,
                  border: '1px solid var(--hairline-strong)',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                Retour
              </button>
            )}
            <button
              onClick={isLast ? finish : () => setStep(s => s + 1)}
              style={{
                padding: '7px 20px', borderRadius: 7,
                border: 'none',
                background: '#66c0f4', color: '#0f161e',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#4fa8e0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#66c0f4')}
            >
              {isLast ? 'Commencer' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
