/**
 * Actus jeux : agrégation RSS (FR + EN).
 * Le texte affiché dans findx est extrait des champs du flux (pas de scraping de page).
 */

export interface GamingNewsItem {
  id: string
  title: string
  url: string
  source: string
  publishedAt: number
  /** Texte lisible issu du flux (corps d’article ou chapô), affiché dans l’app */
  body: string
  /** Image d’aperçu optionnelle */
  thumbnail?: string
  /** Langue indicative du flux source (pour l’UI) */
  locale: 'fr' | 'en'
}

const UA = 'findx/1.0 (desktop; jeu vidéo; contact via app)'

const CONTENT_NS = 'http://purl.org/rss/1.0/modules/content/'
const MEDIA_NS = 'http://search.yahoo.com/mrss/'

const RSS_FEEDS: { url: string; source: string; perFeedLimit: number; locale: 'fr' | 'en' }[] = [
  { url: 'https://www.numerama.com/pop-culture/jeux-video/feed/', source: 'Numerama', perFeedLimit: 8, locale: 'fr' },
  { url: 'https://www.gameblog.fr/rss', source: 'Gameblog', perFeedLimit: 8, locale: 'fr' },
  { url: 'https://www.polygon.com/rss/index.xml', source: 'Polygon', perFeedLimit: 8, locale: 'en' },
  { url: 'https://www.eurogamer.net/feed', source: 'Eurogamer', perFeedLimit: 8, locale: 'en' },
  { url: 'https://www.rockpapershotgun.com/feed/', source: 'Rock Paper Shotgun', perFeedLimit: 8, locale: 'en' },
]

const STATIC_GAMING_NEWS: GamingNewsItem[] = [
  {
    id: 'static-1',
    title: 'Jeuxvideo.com — toute l’actualité jeu vidéo',
    url: 'https://www.jeuxvideo.com/news.htm',
    source: 'jeuxvideo.com',
    publishedAt: Date.now(),
    body: 'Fil d’actus, tests et vidéos sur jeuxvideo.com. Ouvrez le lien ci-dessous pour parcourir le site : le flux réseau n’était pas disponible depuis findx.',
    locale: 'fr',
  },
  {
    id: 'static-2',
    title: 'Numerama — jeux vidéo & pop culture',
    url: 'https://www.numerama.com/pop-culture/jeux-video/',
    source: 'Numerama',
    publishedAt: Date.now() - 86_400_000,
    body: 'Enquêtes et analyses autour du jeu vidéo sur Numerama. Connectez-vous à Internet et touchez « Actualiser » pour charger les articles ici.',
    locale: 'fr',
  },
  {
    id: 'static-3',
    title: 'Gameblog — tests et actualité',
    url: 'https://www.gameblog.fr/',
    source: 'Gameblog',
    publishedAt: Date.now() - 2 * 86_400_000,
    body: 'News, previews et tests sur Gameblog. Sans flux RSS, ces liens vous redirigent vers le site.',
    locale: 'fr',
  },
]

/** Convertit le HTML RSS en texte lisible, avec sauts de paragraphe */
function rssHtmlToPlain(html: string, maxLen: number): string {
  if (!html) return ''
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  t = t.replace(/<\/p>\s*/gi, '\n\n')
  t = t.replace(/<br\s*\/?>/gi, '\n')
  t = t.replace(/<\/h[1-6]>\s*/gi, '\n\n')
  t = t.replace(/<\/li>\s*/gi, '\n')
  t = t.replace(/<[^>]+>/g, ' ')
  t = t.replace(/&nbsp;/g, ' ')
  t = t.replace(/&amp;/g, '&')
  t = t.replace(/&lt;/g, '<')
  t = t.replace(/&gt;/g, '>')
  t = t.replace(/&quot;/g, '"')
  t = t.replace(/&#39;/g, "'")
  t = t.replace(/&#(\d+);/g, (_, n) => {
    const c = Number(n)
    return Number.isFinite(c) ? String.fromCharCode(c) : _
  })
  t = t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
  t = t.replace(/[ \t]{2,}/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  t = t.trim()
  if (t.length <= maxLen) return t
  const cut = t.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > maxLen * 0.85 ? cut.slice(0, lastSpace) : cut) + '…'
}

function firstImgSrc(html: string): string | undefined {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return m?.[1]?.replace(/&amp;/g, '&')
}

function getContentEncoded(item: Element): string | null {
  const nodes = item.getElementsByTagNameNS(CONTENT_NS, 'encoded')
  return nodes[0]?.textContent ?? null
}

function getMediaThumbnail(item: Element): string | undefined {
  const nodes = item.getElementsByTagNameNS(MEDIA_NS, 'thumbnail')
  const u = nodes[0]?.getAttribute('url')
  return u ?? undefined
}

function normalizeItemLink(item: Element): string | null {
  const guidText = item.querySelector('guid')?.textContent?.trim()
  if (guidText && /^https?:\/\//i.test(guidText)) return guidText

  const linkEl = item.querySelector('link')
  let link = linkEl?.textContent?.trim() || linkEl?.getAttribute('href')?.trim()
  if (!link) return null

  if (/^https:\/\/www\.gameblog\.fr\/https:\/\//.test(link)) {
    link = link.replace(/^https:\/\/www\.gameblog\.fr\/(https:\/\/)/, '$1')
  }
  return link
}

function parseRssItems(
  xmlText: string,
  sourceLabel: string,
  limit: number,
  locale: 'fr' | 'en',
): GamingNewsItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  if (doc.querySelector('parsererror')) return []

  const items = doc.getElementsByTagName('item')
  const out: GamingNewsItem[] = []

  for (let i = 0; i < items.length && out.length < limit; i++) {
    const item = items[i]!
    const title = item.querySelector('title')?.textContent?.trim()
    const url = normalizeItemLink(item)
    if (!title || !url) continue

    const pubRaw = item.querySelector('pubDate')?.textContent ?? ''
    const publishedAt = Date.parse(pubRaw) || Date.now() - i * 60_000

    const descRaw = item.querySelector('description')?.textContent ?? ''
    const encoded = getContentEncoded(item) ?? ''
    const descPlain = rssHtmlToPlain(descRaw, 4000)
    const encodedPlain = rssHtmlToPlain(encoded, 14_000)
    let body = ''
    if (encodedPlain.length > descPlain.length + 40) body = encodedPlain
    else if (descPlain.length > 0) body = descPlain
    else body = encodedPlain
    if (!body) body = title

    const encUrl = item.querySelector('enclosure')?.getAttribute('url')
    const thumbMedia = getMediaThumbnail(item)
    const thumbImg =
      encUrl ||
      thumbMedia ||
      firstImgSrc(encoded) ||
      firstImgSrc(descRaw)

    const id = `${sourceLabel}-${url}`.replace(/\s+/g, '').slice(0, 180)

    out.push({
      id,
      title,
      url,
      source: sourceLabel,
      publishedAt,
      body,
      thumbnail: thumbImg,
      locale,
    })
  }

  return out
}

function urlDedupeKey(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    const p = u.pathname.replace(/\/$/, '')
    return `${u.hostname.toLowerCase()}${p}`
  } catch {
    return url.toLowerCase()
  }
}

async function fetchFeedXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': UA,
      },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function loadGamingNews(): Promise<{ items: GamingNewsItem[]; live: boolean }> {
  const batches = await Promise.all(
    RSS_FEEDS.map(async ({ url, source, perFeedLimit, locale }) => {
      const xml = await fetchFeedXml(url)
      if (!xml) return [] as GamingNewsItem[]
      return parseRssItems(xml, source, perFeedLimit, locale)
    }),
  )

  const merged = batches.flat()
  const seen = new Set<string>()
  const deduped: GamingNewsItem[] = []
  for (const item of merged) {
    const key = urlDedupeKey(item.url)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  deduped.sort((a, b) => b.publishedAt - a.publishedAt)
  const items = deduped.slice(0, 20)

  if (items.length > 0) return { items, live: true }
  return { items: STATIC_GAMING_NEWS, live: false }
}
