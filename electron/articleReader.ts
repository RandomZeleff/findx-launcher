/**
 * Télécharge une page d’article et extrait le texte principal (Mozilla Readability).
 * Exécuté dans le processus principal : pas de blocage CORS du navigateur.
 */

import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const UA = 'findx/1.0 (desktop; actualités jeu vidéo; usage personnel)'

/** HTML fragment → texte avec paragraphes (même logique que le parseur RSS côté app). */
function htmlFragmentToPlain(html: string, maxLen: number): string {
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

const FETCH_TIMEOUT_MS = 18_000

export async function fetchArticlePlainText(url: string): Promise<string | null> {
  const u = String(url).trim()
  if (!/^https?:\/\//i.test(u)) return null

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(u, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    if (!html || html.length < 200) return null

    const dom = new JSDOM(html, { url: u })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    if (!article) return null

    let plain = ''
    if (article.content) {
      plain = htmlFragmentToPlain(article.content, 500_000)
    }
    if (!plain && article.textContent) {
      plain = article.textContent.replace(/\n{3,}/g, '\n\n').trim()
    }
    if (!plain || plain.length < 120) return null
    return plain
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
