const STORAGE_KEY = 'wedding-device-id'

export function getDeviceId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID()

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const generated = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, generated)
    return generated
  } catch {
    return crypto.randomUUID()
  }
}
