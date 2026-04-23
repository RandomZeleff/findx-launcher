/**
 * Contenu du changelog : éditer uniquement `changelog.json` (une entrée = une version, la plus récente en tête de fichier).
 * Types de ligne : `add`, `fix`, `remove` (les anciens `improve` sont lus comme `add`).
 */
import changelogData from './changelog.json'

export type ChangeType = 'add' | 'fix' | 'remove'
export type ReleaseType = 'major' | 'minor' | 'patch'

export interface ChangelogHighlight {
  type: ChangeType
  text: string
}

export interface ChangelogEntry {
  version: string
  /** ISO yyyy-mm-dd */
  date: string
  release: ReleaseType
  highlights: ChangelogHighlight[]
}

function normalizeChangeType(t: string): ChangeType {
  if (t === 'improve') return 'add'
  if (t === 'add' || t === 'fix' || t === 'remove') return t
  return 'add'
}

export const CHANGELOG: ChangelogEntry[] = (changelogData as {
  version: string
  date: string
  release: ReleaseType
  highlights: { type: string; text: string }[]
}[]).map(e => ({
  ...e,
  highlights: e.highlights.map(h => ({
    type: normalizeChangeType(h.type),
    text: h.text,
  })),
}))
