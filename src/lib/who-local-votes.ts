import { useCallback, useMemo, useSyncExternalStore } from 'react'

// Die eigenen Stimmen merkt sich der Browser (die Seite zeigt damit, was schon
// beantwortet ist). Gelesen wird über useSyncExternalStore: der erste Render
// auf dem Server und beim Hydrieren kennt nichts davon, danach kommt der
// gemerkte Stand - kein Hydrations-Konflikt.

const VOTES_STORAGE_KEY = 'who-game-votes'

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

// Falls localStorage nicht schreibbar ist (privates Fenster): die Stimme gilt
// serverseitig trotzdem, hier bleibt sie wenigstens für diese Sitzung.
let memoryVotes: Record<string, string> = {}
let memoryVersion = 0

function readStored(): string {
  try {
    return window.localStorage.getItem(VOTES_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

// Der Schnappschuss ist ein String: er vergleicht sich stabil, ein frisch
// geparstes Objekt würde bei jedem Aufruf neu rendern.
function readSnapshot(): string {
  return `${memoryVersion}:${readStored()}`
}

function parseVotes(raw: string): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const votes: Record<string, string> = {}
    for (const [questionId, option] of Object.entries(parsed)) {
      if (typeof option === 'string') votes[questionId] = option
    }
    return votes
  } catch {
    return {}
  }
}

export function useWhoVotes(): {
  votes: Record<string, string>
  remember: (questionId: string, option: string) => void
} {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => '')
  const votes = useMemo(() => {
    // Der Schnappschuss ändert sich mit jeder gemerkten Stimme; gelesen wird
    // der aktuelle Stand daraus.
    void snapshot
    return { ...memoryVotes, ...parseVotes(readStored()) }
  }, [snapshot])

  const remember = useCallback((questionId: string, option: string) => {
    try {
      const current = parseVotes(readStored())
      current[questionId] = option
      window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(current))
    } catch {
      memoryVotes = { ...memoryVotes, [questionId]: option }
      memoryVersion += 1
    }
    listeners.forEach((listener) => listener())
  }, [])

  return { votes, remember }
}
