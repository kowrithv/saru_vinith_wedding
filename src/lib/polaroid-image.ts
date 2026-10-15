// Das Polaroid zum Speichern und Teilen, nach dem Beispiel von Vinith: hochkant
// auf cremeweißem Papier mit runden Ecken, das Foto, darunter der Anlass in
// gesperrten Versalen, die Namen des Brautpaars in Schreibschrift, das Datum
// und eine Zierlinie mit Herz. Der Gast steht in einer kleinen Zeile darunter.
// Gezeichnet wird auf ein Canvas im Browser; das Foto kommt von der Foto-Domain
// (die Bucket-CORS-Regel erlaubt GET für die Seite).

import { fetchPhotoBlob } from './photo-fetch'

export const POLAROID_SIZE = { width: 1000, height: 1500 } as const

export const POLAROID_COLORS = {
  paper: '#f7f5f0',
  edge: '#e2ded3',
  ink: '#1c1c1c',
  text: '#3a3a3a',
  quiet: '#6b6b6b',
} as const

const PAPER_RADIUS = 30
const PHOTO = { x: 62, y: 70, width: 876, height: 1000 } as const
const CENTER_X = POLAROID_SIZE.width / 2

/** Teilmenge des Canvas-Kontexts, die gezeichnet wird (für Tests ersetzbar). */
export interface PolaroidContext {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  globalAlpha: number
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number, maxWidth?: number): void
  measureText(text: string): { width: number }
  drawImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void
  save(): void
  restore(): void
  beginPath(): void
  moveTo(x: number, y: number): void
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void
  arc(x: number, y: number, r: number, start: number, end: number): void
  closePath(): void
  fill(): void
  stroke(): void
  clip(): void
}

export interface PolaroidFonts {
  /** CSS-Schriftfamilie für Anlass und Gast (Cormorant). */
  display: string
  /** CSS-Schriftfamilie für das Datum (Playfair: gerade Ziffern). */
  serif: string
  /** CSS-Schriftfamilie für die Namen des Brautpaars (Great Vibes). */
  script: string
}

/**
 * Ausschnitt eines Fotos im Seitenverhältnis des Rahmens. Hochkant-Fotos werden
 * etwas über der Mitte geschnitten, weil Gesichter meist im oberen Teil liegen.
 */
export function photoCropRect(
  photoWidth: number,
  photoHeight: number,
  frame: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const aspect = frame.width / frame.height
  let width = photoWidth
  let height = Math.round(photoWidth / aspect)
  if (height > photoHeight) {
    height = photoHeight
    width = Math.round(photoHeight * aspect)
  }
  return {
    x: Math.round((photoWidth - width) / 2),
    y: Math.round((photoHeight - height) * (photoHeight > photoWidth ? 0.3 : 0.5)),
    width,
    height,
  }
}

export function polaroidFileName(guestName: string): string {
  const slug = guestName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `polaroid-saruga-vinith-${slug}.png` : 'polaroid-saruga-vinith.png'
}

/** Rechteck mit runden Ecken als Pfad (nur Bögen, ohne roundRect-Unterstützung). */
function roundedRectPath(ctx: PolaroidContext, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5)
  ctx.arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI * 2)
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI * 0.5)
  ctx.arc(x + r, y + h - r, r, Math.PI * 0.5, Math.PI)
  ctx.closePath()
}

interface TrackedText {
  text: string
  centerX: number
  y: number
  size: number
  /** Zeichenabstand in Vielfachen der Schriftgröße. */
  tracking: number
  weight: number
  family: string
  color: string
  maxWidth: number
}

/**
 * Gesperrte Schrift: Zeichen für Zeichen mit Zusatzabstand (letterSpacing gibt
 * es nicht in jedem Browser). Ist die Zeile zu breit, wird die Schrift kleiner.
 */
function drawTracked(ctx: PolaroidContext, spec: TrackedText) {
  let size = spec.size
  const measure = () => {
    ctx.font = `${spec.weight} ${size}px ${spec.family}`
    const gap = size * spec.tracking
    const widths = [...spec.text].map((char) => ctx.measureText(char).width)
    return { widths, gap, total: widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1) }
  }
  let layout = measure()
  if (layout.total > spec.maxWidth) {
    size = Math.floor(size * (spec.maxWidth / layout.total))
    layout = measure()
  }

  ctx.fillStyle = spec.color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  let x = spec.centerX - layout.total / 2
  ;[...spec.text].forEach((char, index) => {
    if (char.trim() !== '') ctx.fillText(char, x, spec.y)
    x += layout.widths[index] + layout.gap
  })
}

/**
 * "Saruga & Vinith" in Schreibschrift. Das "&" steht mit eigenem Abstand
 * zwischen den Namen (die Leerzeichen der Schrift sind für diese Größe zu
 * eng); ist die Zeile zu breit, schrumpft die Schrift.
 */
function drawCoupleNames(ctx: PolaroidContext, coupleName: string, family: string) {
  const parts = coupleName.split(' & ')
  const y = 1238
  ctx.fillStyle = POLAROID_COLORS.ink
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  if (parts.length !== 2) {
    ctx.textAlign = 'center'
    ctx.font = `128px ${family}`
    ctx.fillText(coupleName, CENTER_X, y, 840)
    return
  }

  const maxWidth = 860
  let size = 128
  const layout = () => {
    ctx.font = `${size}px ${family}`
    const gap = size * 0.3
    const first = ctx.measureText(parts[0]).width
    const ampersand = ctx.measureText('&').width
    const second = ctx.measureText(parts[1]).width
    return { gap, first, ampersand, second, total: first + ampersand + second + gap * 2 }
  }
  let sizes = layout()
  if (sizes.total > maxWidth) {
    size = Math.floor(size * (maxWidth / sizes.total))
    sizes = layout()
  }

  let x = CENTER_X - sizes.total / 2
  ctx.fillText(parts[0], x, y)
  x += sizes.first + sizes.gap
  ctx.fillText('&', x, y)
  x += sizes.ampersand + sizes.gap
  ctx.fillText(parts[1], x, y)
}

function drawHeart(ctx: PolaroidContext, cx: number, cy: number, size: number, color: string) {
  const s = size / 2
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx, cy + s * 0.95)
  ctx.bezierCurveTo(cx - s * 2.1, cy - s * 0.3, cx - s * 1.0, cy - s * 1.6, cx, cy - s * 0.55)
  ctx.bezierCurveTo(cx + s * 1.0, cy - s * 1.6, cx + s * 2.1, cy - s * 0.3, cx, cy + s * 0.95)
  ctx.closePath()
  ctx.stroke()
}

interface DrawOptions {
  photo: CanvasImageSource & { width: number; height: number }
  guestName: string
  coupleName: string
  /** z. B. "Standesamtliche Hochzeit"; wird in Versalen gesetzt. */
  occasion: string
  /** z. B. "17.10.2026". */
  date: string
  fonts: PolaroidFonts
}

export function drawPolaroid(
  ctx: PolaroidContext,
  { photo, guestName, coupleName, occasion, date, fonts }: DrawOptions
): void {
  const { width, height } = POLAROID_SIZE

  // Papier mit runden Ecken und feiner Kante; außerhalb bleibt das Bild transparent.
  roundedRectPath(ctx, 0, 0, width, height, PAPER_RADIUS)
  ctx.fillStyle = POLAROID_COLORS.paper
  ctx.fill()
  roundedRectPath(ctx, 1.5, 1.5, width - 3, height - 3, PAPER_RADIUS - 1)
  ctx.strokeStyle = POLAROID_COLORS.edge
  ctx.lineWidth = 3
  ctx.stroke()

  // Foto im Hochformat des Rahmens
  const crop = photoCropRect(photo.width, photo.height, PHOTO)
  ctx.drawImage(photo, crop.x, crop.y, crop.width, crop.height, PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height)

  // Anlass
  drawTracked(ctx, {
    text: occasion.toLocaleUpperCase('de-DE'),
    centerX: CENTER_X,
    y: 1135,
    size: 27,
    tracking: 0.34,
    weight: 600,
    family: fonts.display,
    color: POLAROID_COLORS.text,
    maxWidth: 800,
  })

  // Namen des Brautpaars in Schreibschrift
  drawCoupleNames(ctx, coupleName, fonts.script)

  // Datum
  drawTracked(ctx, {
    text: date,
    centerX: CENTER_X,
    y: 1338,
    size: 30,
    tracking: 0.28,
    weight: 600,
    family: fonts.serif,
    color: POLAROID_COLORS.text,
    maxWidth: 600,
  })

  // Zierlinie: Linie, Herz, Linie
  ctx.fillStyle = POLAROID_COLORS.ink
  ctx.fillRect(CENTER_X - 36 - 130, 1392, 130, 2)
  ctx.fillRect(CENTER_X + 36, 1392, 130, 2)
  drawHeart(ctx, CENTER_X, 1393, 26, POLAROID_COLORS.ink)

  // Der Gast
  drawTracked(ctx, {
    text: `Erinnerung von ${guestName}`.toLocaleUpperCase('de-DE'),
    centerX: CENTER_X,
    y: 1447,
    size: 23,
    tracking: 0.2,
    weight: 600,
    family: fonts.display,
    color: POLAROID_COLORS.quiet,
    maxWidth: 780,
  })

}

function cssFontFamily(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value ? `${value}, ${fallback}` : fallback
}

export interface PolaroidRequest {
  photoUrl: string
  guestName: string
  coupleName: string
  occasion: string
  date: string
}

/** Rendert das Polaroid für das Foto unter `photoUrl` als PNG. */
export async function createPolaroidBlob(request: PolaroidRequest): Promise<Blob> {
  const { photoUrl, guestName, coupleName, occasion, date } = request
  const fonts: PolaroidFonts = {
    display: cssFontFamily('--font-cormorant', 'Georgia, serif'),
    serif: cssFontFamily('--font-playfair', 'Georgia, serif'),
    script: cssFontFamily('--font-great-vibes', 'cursive'),
  }
  // Die Schriften sind im Canvas erst nutzbar, wenn der Browser sie geladen hat.
  try {
    await Promise.all([
      document.fonts.load(`600 27px ${fonts.display}`, `${occasion}${guestName}`),
      document.fonts.load(`600 30px ${fonts.serif}`, date),
      document.fonts.load(`128px ${fonts.script}`, coupleName),
    ])
  } catch {
    // Ohne Schrift-API bleibt es bei der Ersatzschrift.
  }

  // Eigene Adresse für den CORS-Aufruf, siehe photo-fetch.ts.
  const bitmap = await createImageBitmap(await fetchPhotoBlob(photoUrl))

  const canvas = document.createElement('canvas')
  canvas.width = POLAROID_SIZE.width
  canvas.height = POLAROID_SIZE.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar.')

  drawPolaroid(ctx as unknown as PolaroidContext, {
    photo: bitmap,
    guestName,
    coupleName,
    occasion,
    date,
    fonts,
  })
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden.'))),
      'image/png'
    )
  })
}
