import { CHANGELOG, type ChangeType, type ReleaseType } from '../data/changelog'

function formatChangelogDate(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const CHANGE_META: Record<ChangeType, { symbol: string; label: string; color: string; bg: string }> = {
  add:    { symbol: '+', label: 'Ajout',       color: '#5ba85b', bg: 'rgba(91,168,91,0.12)'   },
  fix:    { symbol: '!', label: 'Correctif',  color: '#d98f00', bg: 'rgba(217,143,0,0.12)'   },
  remove: { symbol: '−', label: 'Suppression', color: '#c0392b', bg: 'rgba(192,57,43,0.12)'   },
}

const RELEASE_META: Record<ReleaseType, { label: string; color: string; bg: string }> = {
  major: { label: 'Majeure', color: '#66c0f4', bg: 'rgba(102,192,244,0.15)' },
  minor: { label: 'Mineure', color: '#8f98a0', bg: 'rgba(143,152,160,0.12)' },
  patch: { label: 'Patch',   color: '#8f98a0', bg: 'rgba(143,152,160,0.10)' },
}

function countByType(highlights: { type: ChangeType }[]) {
  const counts: Partial<Record<ChangeType, number>> = {}
  for (const h of highlights) counts[h.type] = (counts[h.type] ?? 0) + 1
  return counts
}

export function News() {
  const latest    = CHANGELOG[0]
  const older     = CHANGELOG.slice(1)
  const totalChanges = CHANGELOG.reduce((acc, e) => acc + e.highlights.length, 0)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl px-10 py-10 space-y-10">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight mb-1">Changelog</h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              {CHANGELOG.length} version{CHANGELOG.length > 1 ? 's' : ''} · {totalChanges} changements
            </p>
          </div>
          {/* Légende */}
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(CHANGE_META) as ChangeType[]).map(type => {
              const m = CHANGE_META[type]
              return (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded"
                  style={{ color: m.color, background: m.bg }}
                >
                  <span className="font-bold font-mono">{m.symbol}</span>
                  <span>{m.label}</span>
                </span>
              )
            })}
          </div>
        </div>

        {/* ── Version actuelle — carte hero ────────────────────────────────── */}
        {latest && (() => {
          const rb     = RELEASE_META[latest.release]
          const counts = countByType(latest.highlights)
          return (
            <div
              className="rounded-xl p-6 space-y-5"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--hairline-strong)' }}
            >
              {/* En-tête de la carte */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-2xl font-bold text-white tracking-tight">v{latest.version}</span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{ color: rb.color, background: rb.bg }}
                    >
                      {rb.label}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{ color: 'var(--color-accent)', background: 'rgba(102,192,244,0.1)' }}
                    >
                      Version actuelle
                    </span>
                  </div>
                  <time dateTime={latest.date} className="text-xs text-[var(--color-text-muted)] tabular-nums block">
                    {formatChangelogDate(latest.date)}
                  </time>
                </div>

                {/* Compteurs par type */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(Object.keys(CHANGE_META) as ChangeType[])
                    .filter(t => counts[t])
                    .map(t => {
                      const m = CHANGE_META[t]
                      return (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded"
                          style={{ color: m.color, background: m.bg }}
                        >
                          <span className="font-mono">{m.symbol}</span>
                          {counts[t]}
                        </span>
                      )
                    })}
                </div>
              </div>

              {/* Séparateur */}
              <div style={{ height: 1, background: 'var(--hairline)' }} />

              {/* Highlights */}
              <ul className="space-y-3">
                {latest.highlights.map((item, i) => {
                  const m = CHANGE_META[item.type]
                  return (
                    <li key={i} className="flex items-baseline gap-3">
                      <span
                        className="shrink-0 text-[11px] font-bold font-mono w-5 text-center rounded py-0.5 leading-none"
                        style={{ color: m.color, background: m.bg }}
                      >
                        {m.symbol}
                      </span>
                      <span className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                        {item.text}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })()}

        {/* ── Versions précédentes — timeline ──────────────────────────────── */}
        {older.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                Versions précédentes
              </span>
              <div className="flex-1 h-px bg-[var(--hairline)]" />
            </div>

            <ol className="relative" style={{ paddingLeft: '2rem' }}>
              <div
                className="absolute top-2 bottom-2 w-px"
                style={{ left: '0.28rem', background: 'var(--color-border)' }}
                aria-hidden
              />
              <div className="space-y-10">
                {older.map((entry) => {
                  const rb     = RELEASE_META[entry.release]
                  const counts = countByType(entry.highlights)
                  return (
                    <li key={entry.version} className="relative">
                      <span
                        className="absolute w-2.5 h-2.5 rounded-full"
                        style={{
                          left: '-2rem', top: '0.2rem',
                          background: 'var(--color-bg-surface)',
                          border: '2px solid var(--color-border)',
                          boxShadow: '0 0 0 3px var(--color-bg-base)',
                        }}
                        aria-hidden
                      />

                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <span className="text-sm font-bold text-white tracking-tight">v{entry.version}</span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ color: rb.color, background: rb.bg }}
                        >
                          {rb.label}
                        </span>
                        <time dateTime={entry.date} className="text-xs text-[var(--color-text-muted)] tabular-nums">
                          {formatChangelogDate(entry.date)}
                        </time>
                        <div className="flex items-center gap-1.5 ml-1">
                          {(Object.keys(CHANGE_META) as ChangeType[])
                            .filter(t => counts[t])
                            .map(t => {
                              const m = CHANGE_META[t]
                              return (
                                <span
                                  key={t}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ color: m.color, background: m.bg }}
                                >
                                  <span className="font-mono">{m.symbol}</span>{counts[t]}
                                </span>
                              )
                            })}
                        </div>
                      </div>

                      <ul className="space-y-2 mt-3">
                        {entry.highlights.map((item, i) => {
                          const m = CHANGE_META[item.type]
                          return (
                            <li key={i} className="flex items-baseline gap-3">
                              <span
                                className="shrink-0 text-[11px] font-bold font-mono w-5 text-center rounded py-0.5 leading-none"
                                style={{ color: m.color, background: m.bg }}
                              >
                                {m.symbol}
                              </span>
                              <span className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                                {item.text}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </div>
            </ol>
          </div>
        )}

      </div>
    </div>
  )
}
