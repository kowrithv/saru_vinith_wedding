'use client'

import { useEffect, useRef } from 'react'

interface UsePollingOptions {
  minDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
}

export function usePolling(fetchFn: () => void, options: UsePollingOptions = {}): void {
  const { minDelayMs = 3000, maxDelayMs = 30000, backoffFactor = 1.5 } = options
  const fetchFnRef = useRef(fetchFn)

  useEffect(() => {
    fetchFnRef.current = fetchFn
  })

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let delay = minDelayMs
    let stopped = false

    const tick = () => {
      if (stopped || document.hidden) {
        timeoutId = undefined
        return
      }
      fetchFnRef.current()
      timeoutId = setTimeout(tick, delay)
      delay = Math.min(delay * backoffFactor, maxDelayMs)
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && timeoutId === undefined && !stopped) {
        delay = minDelayMs
        tick()
      }
    }

    tick()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopped = true
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [minDelayMs, maxDelayMs, backoffFactor])
}
