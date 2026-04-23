export function getApiBase(): string {
  return (import.meta.env.VITE_API_URL || 'https://anime.nartya.app/launcher').replace(/\/$/, '')
}

// ── Image helpers ──────────────────────────────────────────────────────────────

/**
 * Ne modifie plus les URLs Steam : les anciennes réécritures (header → library_hero, etc.)
 * produisaient des chemins invalides sur le CDN actuel (store_item_assets / akamai).
 */
export function optimizeSteamMediaUrl(url: string): string {
  return url
}

export interface ProxyImageOptions {
  steamOptimize?: boolean
}

export function proxyImageUrl(
  url: string | null | undefined,
  options?: ProxyImageOptions,
): string | null {
  if (!url) return null
  const optimize = options?.steamOptimize !== false
  return optimize ? optimizeSteamMediaUrl(url) : url
}

export function heroBackdropCandidates(game: {
  hero_image_url?: string | null
  image_url?: string | null
}): string[] {
  const out: string[] = []
  const push = (s: string | null | undefined) => {
    if (s && !out.includes(s)) out.push(s)
  }

  const hero = game.hero_image_url?.trim() || null
  const cov = game.image_url?.trim() || null
  const primary = hero || cov

  push(proxyImageUrl(primary))
  push(proxyImageUrl(primary, { steamOptimize: false }))

  if (cov && cov !== primary) {
    push(proxyImageUrl(cov))
    push(proxyImageUrl(cov, { steamOptimize: false }))
  }

  for (const u of [...out]) {
    const q = u.indexOf('?')
    if (q === -1) continue
    const base = u.slice(0, q)
    push(base)
  }

  return out
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

export async function apiFetchBinary(
  path: string,
  init?: { signal?: AbortSignal },
): Promise<ArrayBuffer> {
  const res = await fetch(`${getApiBase()}${path}`, { signal: init?.signal })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }

  return res.arrayBuffer()
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}
