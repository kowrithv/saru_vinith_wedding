// Hilfsfunktionen für die Lasttest-Szenarien (siehe scenarios.mjs).

/** Nearest-Rank-Perzentil einer aufsteigend sortierten Liste. */
export function percentile(sortedAscending, p) {
  if (sortedAscending.length === 0) return 0
  const rank = Math.max(1, Math.ceil((p / 100) * sortedAscending.length))
  return sortedAscending[Math.min(rank, sortedAscending.length) - 1]
}

export function summarize(latenciesMs) {
  const sorted = [...latenciesMs].sort((a, b) => a - b)
  const count = sorted.length
  const mean = count === 0 ? 0 : Math.round(sorted.reduce((sum, v) => sum + v, 0) / count)
  return {
    count,
    mean,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: count === 0 ? 0 : sorted[count - 1],
  }
}

/**
 * Führt worker(0..count-1) mit höchstens `concurrency` gleichzeitigen Läufen
 * aus. Ergebnisse stehen in Eingabe-Reihenfolge; ein werfender Worker wird zu
 * { error } und stoppt die übrigen nicht.
 */
export async function runPool(count, concurrency, worker) {
  const results = new Array(count)
  let next = 0
  async function lane() {
    while (next < count) {
      const index = next++
      try {
        results[index] = await worker(index)
      } catch (error) {
        results[index] = { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, lane))
  return results
}

/** Eine eigene, stabile Adresse je simuliertem Gast (für x-forwarded-for). */
export function guestIp(index) {
  return `10.${(index >> 16) & 255}.${(index >> 8) & 255}.${(index & 255) + 1}`
}

/** Die Szenarien schreiben Daten - nur gegen lokale Test-Server erlaubt. */
export function isLocalUrl(url) {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}
