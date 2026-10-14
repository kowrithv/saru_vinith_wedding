import { useCallback, useEffect, useState } from 'react'

// Gästebuch, Erinnerungen und Galerie teilen sich ein Kennwort. Ist es einmal
// angenommen, merkt sich der Browser die Sitzung (HttpOnly-Cookie, vom Server
// gesetzt): dieser Hook fragt nur, ob sie noch gilt, und kann das Kennwort
// aus dem QR-Link (`/gallery#k=<Kennwort>`) einlösen.
//
// Das Kennwort steht hinter dem `#`: der Browser schickt diesen Teil nie an
// den Server, er landet weder in Logs noch im Referer. Es wird sofort aus der
// Adresszeile entfernt, damit es nicht in Verlauf, Lesezeichen oder
// geteilten Links hängen bleibt.

export type GuestAccessStatus = 'checking' | 'locked' | 'unlocked'
export type UnlockResult = { ok: true } | { ok: false; error: string }

const KEY_PARAM = 'k'
const UNLOCK_FAILED_MESSAGE = 'Entsperren fehlgeschlagen. Bitte versuch es erneut.'

function takeAccessKeyFromAddress(): string | null {
  if (typeof window === 'undefined') return null
  const { hash, pathname, search } = window.location
  if (!hash.startsWith('#')) return null

  const params = new URLSearchParams(hash.slice(1))
  const key = params.get(KEY_PARAM)
  if (key === null) return null

  params.delete(KEY_PARAM)
  const rest = params.toString()
  // history.state unverändert lassen: der Next.js-Router hängt seinen
  // Zustand daran.
  window.history.replaceState(window.history.state, '', `${pathname}${search}${rest ? `#${rest}` : ''}`)
  return key
}

async function requestUnlock(password: string): Promise<UnlockResult> {
  try {
    const response = await fetch('/api/gallery/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (response.ok) return { ok: true }
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: body?.error ?? 'Falsches Kennwort.' }
  } catch {
    return { ok: false, error: UNLOCK_FAILED_MESSAGE }
  }
}

async function requestAccess(): Promise<boolean> {
  try {
    const response = await fetch('/api/access', { cache: 'no-store' })
    if (!response.ok) return false
    const body = (await response.json()) as { unlocked?: boolean }
    return body.unlocked === true
  } catch {
    // Server nicht erreichbar: das Kennwortfeld zu zeigen schadet nicht.
    return false
  }
}

// React Strict Mode führt Effekte im Dev-Server doppelt aus: der Schlüssel ist
// beim zweiten Lauf schon aus der Adresse entfernt. Beide Läufe teilen sich
// deshalb den einen laufenden Einlöse-Versuch.
let pendingKeyUnlock: Promise<UnlockResult> | null = null

export function useGuestAccess() {
  const [status, setStatus] = useState<GuestAccessStatus>('checking')
  // Der QR-Link trug ein Kennwort, das nicht (mehr) gilt.
  const [linkRejected, setLinkRejected] = useState(false)

  useEffect(() => {
    let active = true

    const key = takeAccessKeyFromAddress()
    if (key !== null) {
      const attempt: Promise<UnlockResult> = requestUnlock(key).finally(() => {
        if (pendingKeyUnlock === attempt) pendingKeyUnlock = null
      })
      pendingKeyUnlock = attempt
    }

    const outcome = pendingKeyUnlock
      ? pendingKeyUnlock.then((result) => ({ unlocked: result.ok, rejected: !result.ok }))
      : requestAccess().then((unlocked) => ({ unlocked, rejected: false }))

    void outcome.then(({ unlocked, rejected }) => {
      if (!active) return
      setStatus(unlocked ? 'unlocked' : 'locked')
      setLinkRejected(rejected)
    })

    return () => {
      active = false
    }
  }, [])

  const unlock = useCallback(async (password: string): Promise<UnlockResult> => {
    const result = await requestUnlock(password)
    if (result.ok) {
      setStatus('unlocked')
      setLinkRejected(false)
    }
    return result
  }, [])

  const markUnlocked = useCallback(() => {
    setStatus('unlocked')
    setLinkRejected(false)
  }, [])
  const markLocked = useCallback(() => setStatus('locked'), [])

  return { status, linkRejected, unlock, markUnlocked, markLocked }
}
