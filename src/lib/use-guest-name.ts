import { useState, useSyncExternalStore } from 'react'

// Der Name steht in Gästebuch, Erinnerungen und Foto-Upload: wer ihn einmal
// getippt hat, soll ihn nicht noch zweimal eingeben. Er bleibt nur in diesem
// Browser (localStorage), geht nie an den Server außer als Teil des Eintrags,
// und das Feld bleibt jederzeit änderbar (geteiltes Handy).
const STORAGE_KEY = 'wedding-guest-name'
const MAX_LENGTH = 60 // wie das maxLength der Felder

const listeners = new Set<() => void>()

function readStoredName(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Ein anderer Tab hat den Namen geändert.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function saveGuestName(name: string): void {
  const value = name.trim().slice(0, MAX_LENGTH)
  // Ein leerer Name löscht den gemerkten nicht.
  if (!value) return
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Privater Modus o. Ä.: der Name wird dann nur nicht weitergegeben.
  }
  listeners.forEach((listener) => listener())
}

export function useGuestName() {
  // Auf dem Server (und beim ersten Hydrations-Render) ist der gemerkte Name
  // unbekannt: erst danach liefert der Store den Wert.
  const stored = useSyncExternalStore(subscribe, readStoredName, () => '')
  // null = noch nicht angefasst: das Feld zeigt den gemerkten Namen. Ein
  // geleertes Feld bleibt leer ('' ist nicht null).
  const [typed, setTyped] = useState<string | null>(null)

  return { name: typed ?? stored, setName: setTyped, remember: saveGuestName }
}
