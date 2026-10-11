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

    const clearPending = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
    }

    const tick = () => {
      if (stopped || document.hidden) return
      fetchFnRef.current()
      timeoutId = setTimeout(tick, delay)
      delay = Math.min(delay * backoffFactor, maxDelayMs)
    }

    const handleVisibilityChange = () => {
      // Egal ob gerade versteckt oder sichtbar: ein noch laufender Timer aus
      // dem jeweils anderen Zustand ist nicht mehr gültig - immer zuerst
      // aufräumen, statt am alten Intervall festzuhalten.
      clearPending()
      if (document.hidden || stopped) return
      delay = minDelayMs
      tick()
    }

    tick()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopped = true
      clearPending()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [minDelayMs, maxDelayMs, backoffFactor])
}
