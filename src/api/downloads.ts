import { apiFetch } from './client'

export interface QueueEntry {
  id: number
  gameId: string
  linkId: string | null
  url: string
  text: string | null
  type: string
  status: 'queued' | 'downloading' | 'paused' | 'done' | 'failed' | 'cancelled'
  progress: number
  speedBps: number | null
  bytesTotal: number | null
  bytesDone: number
  outputPath: string | null
  error: string | null
  queuedAt: number
}

export const downloadsApi = {
  start(gameId: string, linkId?: string) {
    return apiFetch<QueueEntry>('/api/downloads', {
      method: 'POST',
      body: JSON.stringify({ gameId, linkId }),
    })
  },

  list() {
    return apiFetch<QueueEntry[]>('/api/downloads')
  },

  pause(id: number) {
    return apiFetch<{ ok: boolean }>(`/api/downloads/${id}/pause`, { method: 'PATCH' })
  },

  resume(id: number) {
    return apiFetch<{ ok: boolean }>(`/api/downloads/${id}/resume`, { method: 'PATCH' })
  },

  cancel(id: number) {
    return apiFetch<{ ok: boolean }>(`/api/downloads/${id}`, { method: 'DELETE' })
  },
}
