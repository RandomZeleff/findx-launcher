import { apiFetch } from './client'

export interface ScrapingStatus {
  running: boolean
  phase: string | null
  index: number
  total: number
  startedAt: number | null
  finishedAt: number | null
  error: string | null
}

export const scrapingApi = {
  status() {
    return apiFetch<ScrapingStatus>('/api/scraping/status')
  },

  trigger(phase: 'listings' | 'analysis' | 'full') {
    return apiFetch<{ ok: boolean; phase: string }>('/api/scraping/trigger', {
      method: 'POST',
      body: JSON.stringify({ phase }),
    })
  },

  stop() {
    return apiFetch<{ ok: boolean }>('/api/scraping/stop', { method: 'POST' })
  },
}
