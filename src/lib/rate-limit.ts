export interface RateLimiterOptions {
  maxAttempts: number
  windowMs: number
  now?: () => number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

interface Bucket {
  count: number
  windowStart: number
}

export class RateLimiter {
  private readonly maxAttempts: number
  private readonly windowMs: number
  private readonly now: () => number
  private readonly buckets = new Map<string, Bucket>()
  private nextSweepAt = 0

  constructor(options: RateLimiterOptions) {
    this.maxAttempts = options.maxAttempts
    this.windowMs = options.windowMs
    this.now = options.now ?? Date.now
  }

  /** Anzahl der aktuell gemerkten Schlüssel (Bestand, nicht nur aktive). */
  get size(): number {
    return this.buckets.size
  }

  // Abgelaufene Einträge würden sonst für jede je gesehene Adresse bis zum
  // Neustart im Speicher bleiben. Ein Durchlauf je Zeitfenster genügt.
  private sweepExpired(now: number): void {
    if (now < this.nextSweepAt) return
    this.nextSweepAt = now + this.windowMs
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart >= this.windowMs) this.buckets.delete(key)
    }
  }

  check(key: string): RateLimitResult {
    const now = this.now()
    this.sweepExpired(now)
    const bucket = this.buckets.get(key)

    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now })
      return { allowed: true, retryAfterMs: 0 }
    }

    if (bucket.count < this.maxAttempts) {
      bucket.count += 1
      return { allowed: true, retryAfterMs: 0 }
    }

    return {
      allowed: false,
      retryAfterMs: bucket.windowStart + this.windowMs - now,
    }
  }

  reset(key: string): void {
    this.buckets.delete(key)
  }
}
