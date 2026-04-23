import type { GamingNewsItem } from './gamingNews'

const DEFAULT_MIN_GAIN = 80

/**
 * Télécharge chaque page d’article (processus Electron) et remonte un texte plus complet que le RSS.
 * Traitement par lots pour ne pas saturer les sites.
 */
export async function enrichNewsItemsInBatches(
  items: GamingNewsItem[],
  onEnriched: (id: string, text: string) => void,
  options?: { concurrency?: number; minGain?: number },
): Promise<void> {
  const fetchFn = window.electron?.news?.fetchArticleText
  if (!fetchFn || items.length === 0) return

  const concurrency = Math.max(1, Math.min(6, options?.concurrency ?? 4))
  const minGain = options?.minGain ?? DEFAULT_MIN_GAIN

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async item => {
        try {
          const res = await fetchFn(item.url)
          if (!res?.ok || !res.text) return
          if (res.text.length >= item.body.length + minGain) {
            onEnriched(item.id, res.text)
          }
        } catch {
          /* ignore */
        }
      }),
    )
  }
}
