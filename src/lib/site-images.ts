import { couple } from './site-content'

// Die Bilder der Startseite liegen als Dateien in public/: zum Tauschen die
// Datei ersetzen (gleicher Name), im Code ändert sich nichts.

/** Das Paarfoto im Bogenrahmen (hochkant, ca. 800 x 1200 px, unter 200 KB). */
export const heroPhoto = '/hero/paar.jpg'

/** Vier kleine Fotos auf der Kachel "Unsere Fotos" (quadratisch, 160 x 160 px). */
export const homePreviewPhotos: string[] = [
  '/home/foto-1.jpg',
  '/home/foto-2.jpg',
  '/home/foto-3.jpg',
  '/home/foto-4.jpg',
]

/**
 * Porträts für "Wer von uns?" (quadratisch, 192 x 192 px), nach dem Namen der
 * Antwort. Sie sind Ausschnitte aus dem Paarfoto: zum Tauschen die Datei
 * ersetzen (gleicher Name). "Beide" zeigt beide Porträts zusammen.
 */
export const whoPortraits: ReadonlyMap<string, string> = new Map([
  [couple.bride, '/who/saruga.jpg'],
  [couple.groom, '/who/vinith.jpg'],
])
