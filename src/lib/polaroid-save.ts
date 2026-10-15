export type PolaroidSaveOutcome = 'shared' | 'downloaded' | 'cancelled'

// Am Handy ist das Teilen-Menü der kürzeste Weg in die Fotos ("Bild sichern"
// bzw. direkt an WhatsApp); ein Download landet bei iPhones in der Dateien-App,
// wo ihn kaum jemand sucht. Am Computer bleibt es beim Download.
function canShareFile(file: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) return false
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
}

function download(blob: Blob, fileName: string): void {
  // Ein <a download> mit Blob-Adresse (dieselbe Herkunft) wird auch von
  // iPhone-Safari und Android-Chrome als Speichern behandelt.
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Gibt das fertige Polaroid an den Gast: am Handy über das Teilen-Menü, sonst
 * (oder wenn der Browser das Teilen verweigert) als Download. Schließt der Gast
 * das Menü, ist das keine Störung und es folgt nichts.
 */
export async function savePolaroidFile(blob: Blob, fileName: string, title: string): Promise<PolaroidSaveOutcome> {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' })

  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Sonst z. B. NotAllowedError (die Geste ist nach dem Rendern verfallen):
      // der Download funktioniert trotzdem.
    }
  }

  download(blob, fileName)
  return 'downloaded'
}
