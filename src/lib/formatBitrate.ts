/** Débit en octets/s → libellé court, sans traîne de décimales parasite. */
export function formatBitrate(bps: number): string {
  let n = Number(bps)
  if (!Number.isFinite(n) || n < 0) n = 0
  if (n >= 1_000_000) {
    const mb = n / 1_000_000
    if (mb >= 100) return `${Math.round(mb)} MB/s`
    if (mb >= 10) return `${Math.round(mb * 10) / 10} MB/s`
    return `${Math.round(mb * 100) / 100} MB/s`
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)} KB/s`
  return `${Math.round(n)} B/s`
}
