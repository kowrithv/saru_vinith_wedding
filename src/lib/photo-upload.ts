import { createPreviewImage } from './gallery-preview'

// Lädt EIN Foto per Ticket direkt nach R2 und gibt das Ticket zurück. Das
// Registrieren (Galerie-Foto anlegen) übernimmt der Aufrufer, hier die
// Erinnerungs-Seite per POST /api/memories. Das Upload-Formular der Galerie
// hat dafür eine eigene, auf viele Dateien ausgelegte Logik.

export type PhotoUploadResult =
  | { ok: true; ticket: string }
  /** `unauthorized`: Kennwort falsch oder die gemerkte Sitzung gilt nicht mehr. */
  | { ok: false; error: string; unauthorized?: boolean }

interface UploadPhotoOptions {
  file: File
  contentType: string
  category: string
  /** Nur nötig, solange der Browser nicht entsperrt ist. */
  password?: string
  signal?: AbortSignal
}

// Wie im Galerie-Formular: das Limit wächst mit der Größe (Untergrenze
// 20 KB/s), bleibt über 5 Minuten und endet mit dem Ticket (15 Minuten).
const MIN_TIMEOUT_MS = 5 * 60 * 1000
const MAX_TIMEOUT_MS = 15 * 60 * 1000
const MIN_BYTES_PER_SECOND = 20 * 1024

const GENERIC_ERROR = 'Hochladen fehlgeschlagen. Bitte versuch es erneut.'

interface IssuedTicket {
  thumbPutUrl: string
  originalPutUrl: string
  ticket: string
}

export async function uploadPhotoForTicket(options: UploadPhotoOptions): Promise<PhotoUploadResult> {
  const { file, contentType, category, password, signal } = options
  const controller = new AbortController()
  let timedOut = false
  const onCancel = () => controller.abort()
  signal?.addEventListener('abort', onCancel)
  const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, (file.size / MIN_BYTES_PER_SECOND) * 1000))
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    // Die Größe der Vorschau steht im Ticket und wird fest signiert.
    const preview = await createPreviewImage(file)

    const requestResponse = await fetch('/api/uploads/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        ...(password ? { password } : {}),
        category,
        files: [{ filename: file.name, size: file.size, contentType, thumbSize: preview.blob.size }],
      }),
    })
    if (!requestResponse.ok) {
      const body = (await requestResponse.json().catch(() => null)) as { error?: string } | null
      return {
        ok: false,
        error: body?.error ?? GENERIC_ERROR,
        ...(requestResponse.status === 401 ? { unauthorized: true } : {}),
      }
    }
    const { tickets } = (await requestResponse.json()) as { tickets: IssuedTicket[] }
    const ticket = tickets[0]

    const [thumbResponse, originalResponse] = await Promise.all([
      fetch(ticket.thumbPutUrl, {
        method: 'PUT',
        body: preview.blob,
        headers: { 'Content-Type': 'image/jpeg' },
        signal: controller.signal,
      }),
      fetch(ticket.originalPutUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
        signal: controller.signal,
      }),
    ])
    if (!thumbResponse.ok || !originalResponse.ok) {
      return { ok: false, error: 'Übertragung fehlgeschlagen.' }
    }
    return { ok: true, ticket: ticket.ticket }
  } catch {
    if (timedOut) return { ok: false, error: 'Zeitüberschreitung – bitte erneut versuchen.' }
    if (signal?.aborted) return { ok: false, error: 'Abgebrochen.' }
    return { ok: false, error: GENERIC_ERROR }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCancel)
    // Scheitert eine der beiden Übertragungen, soll die andere nicht
    // weiterlaufen.
    controller.abort()
  }
}
