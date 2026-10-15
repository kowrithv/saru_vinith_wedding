// Das Polaroid zum Speichern und Teilen: Foto, Bordeaux-Banner mit den Namen
// des Brautpaars, Name des Gastes in Schreibschrift, kleine Blüten in den
// Ecken. Gezeichnet wird auf ein Canvas im Browser; das Foto kommt von der
// Foto-Domain (die Bucket-CORS-Regel erlaubt GET für die Seite).

export const POLAROID_SIZE = { width: 1000, height: 1240 } as const

export const POLAROID_COLORS = {
  frame: '#ffffff',
  paper: '#fffdf8',
  bordeaux: '#7a2432',
  gold: '#c9a84c',
  champagne: '#faf0dc',
  navy: '#1e3a5f',
  leaf: '#7a9a7e',
} as const

const MARGIN = 50
const PHOTO_SIZE = POLAROID_SIZE.width - MARGIN * 2
const BANNER_TOP = MARGIN + PHOTO_SIZE + 36
const BANNER_HEIGHT = 120

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
  strokeRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number, maxWidth?: number): void
  drawImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void
  save(): void
  restore(): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  scale(x: number, y: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number): void
  arc(x: number, y: number, r: number, start: number, end: number): void
  closePath(): void
  fill(): void
}

export interface PolaroidFonts {
  /** CSS-Schriftfamilie für die Namen (Cormorant). */
  display: string
  /** CSS-Schriftfamilie für die Unterschrift (Great Vibes). */
  script: string
}

/**
 * Quadratischer Ausschnitt eines Fotos. Hochkant-Fotos werden etwas über der
 * Mitte geschnitten, weil Gesichter meist im oberen Teil liegen.
 */
export function photoCropRect(width: number, height: number): { x: number; y: number; size: number } {
  const size = Math.min(width, height)
  return {
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) * (height > width ? 0.3 : 0.5)),
    size,
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

function drawPetal(ctx: PolaroidContext) {
  ctx.beginPath()
  ctx.moveTo(0, -4)
  ctx.bezierCurveTo(-7, -12, -7, -22, 0, -28)
  ctx.bezierCurveTo(7, -22, 7, -12, 0, -4)
  ctx.closePath()
  ctx.fill()
}

/** Lotus wie auf der Seite (acht Blätter), mittig bei (x, y), Radius ca. `size`. */
function drawLotus(ctx: PolaroidContext, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 28, size / 28)
  ctx.fillStyle = color
  for (let i = 0; i < 8; i++) {
    ctx.globalAlpha = i % 2 === 0 ? 0.95 : 0.7
    ctx.save()
    ctx.rotate((Math.PI / 4) * i)
    drawPetal(ctx)
    ctx.restore()
  }
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawFlower(ctx: PolaroidContext, x: number, y: number, radius: number) {
  ctx.fillStyle = POLAROID_COLORS.bordeaux
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2
    ctx.beginPath()
    ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, radius * 0.75, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = POLAROID_COLORS.gold
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2)
  ctx.fill()
}

function drawLeaf(ctx: PolaroidContext, x: number, y: number, angle: number, length: number) {
  ctx.fillStyle = POLAROID_COLORS.leaf
  ctx.beginPath()
  ctx.ellipse(x, y, length, length * 0.38, angle, 0, Math.PI * 2)
  ctx.fill()
}

/** Kleiner Zweig mit zwei Blüten und zwei Blättern; `flip` spiegelt ihn für die untere Ecke. */
function drawSpray(ctx: PolaroidContext, x: number, y: number, flip: 1 | -1) {
  const k = 1.7 // Größe im Verhältnis zum Entwurf; die Blüten sollen im kleinen Bild noch auffallen
  drawLeaf(ctx, x + 40 * k * flip, y + 14 * k * flip, 0.5 * flip, 30 * k)
  drawLeaf(ctx, x + 12 * k * flip, y + 42 * k * flip, 1.1 * flip, 30 * k)
  drawFlower(ctx, x + 16 * k * flip, y + 16 * k * flip, 12 * k)
  drawFlower(ctx, x + 50 * k * flip, y + 36 * k * flip, 9 * k)
}

interface DrawOptions {
  photo: CanvasImageSource & { width: number; height: number }
  guestName: string
  coupleName: string
  fonts: PolaroidFonts
}

export function drawPolaroid(ctx: PolaroidContext, { photo, guestName, coupleName, fonts }: DrawOptions): void {
  const { width, height } = POLAROID_SIZE

  // Rahmen
  ctx.fillStyle = POLAROID_COLORS.frame
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = POLAROID_COLORS.gold
  ctx.lineWidth = 2
  ctx.strokeRect(14, 14, width - 28, height - 28)

  // Foto, quadratisch zugeschnitten
  const crop = photoCropRect(photo.width, photo.height)
  ctx.drawImage(photo, crop.x, crop.y, crop.size, crop.size, MARGIN, MARGIN, PHOTO_SIZE, PHOTO_SIZE)

  // Banner mit den Namen des Brautpaars
  ctx.fillStyle = POLAROID_COLORS.bordeaux
  ctx.fillRect(MARGIN, BANNER_TOP, PHOTO_SIZE, BANNER_HEIGHT)
  ctx.strokeStyle = POLAROID_COLORS.gold
  ctx.lineWidth = 2
  ctx.strokeRect(MARGIN + 10, BANNER_TOP + 10, PHOTO_SIZE - 20, BANNER_HEIGHT - 20)

  const centerX = width / 2
  const bannerMiddle = BANNER_TOP + BANNER_HEIGHT / 2
  ctx.fillStyle = POLAROID_COLORS.champagne
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 62px ${fonts.display}`
  ctx.fillText(coupleName, centerX, bannerMiddle + 2, PHOTO_SIZE - 220)
  drawLotus(ctx, MARGIN + 74, bannerMiddle, 24, POLAROID_COLORS.gold)
  drawLotus(ctx, width - MARGIN - 74, bannerMiddle, 24, POLAROID_COLORS.gold)

  // Unterschrift des Gastes
  ctx.fillStyle = POLAROID_COLORS.navy
  ctx.font = `76px ${fonts.script}`
  ctx.fillText(guestName, centerX, BANNER_TOP + BANNER_HEIGHT + 80, PHOTO_SIZE - 120)

  // Blüten in zwei Ecken, über Rahmen und Foto
  drawSpray(ctx, 10, 10, 1)
  drawSpray(ctx, width - 10, height - 10, -1)
}

function cssFontFamily(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value ? `${value}, ${fallback}` : fallback
}

/** Rendert das Polaroid für das Foto unter `photoUrl` als PNG. */
export async function createPolaroidBlob(photoUrl: string, guestName: string, coupleName: string): Promise<Blob> {
  const fonts: PolaroidFonts = {
    display: cssFontFamily('--font-cormorant', 'Georgia, serif'),
    script: cssFontFamily('--font-great-vibes', 'cursive'),
  }
  // Die Schriften sind im Canvas erst nutzbar, wenn der Browser sie geladen hat.
  try {
    await Promise.all([
      document.fonts.load(`600 62px ${fonts.display}`, coupleName),
      document.fonts.load(`76px ${fonts.script}`, guestName),
    ])
  } catch {
    // Ohne Schrift-API bleibt es bei der Ersatzschrift.
  }

  const response = await fetch(photoUrl)
  if (!response.ok) throw new Error('Foto konnte nicht geladen werden.')
  const bitmap = await createImageBitmap(await response.blob())

  const canvas = document.createElement('canvas')
  canvas.width = POLAROID_SIZE.width
  canvas.height = POLAROID_SIZE.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar.')

  drawPolaroid(ctx as unknown as PolaroidContext, { photo: bitmap, guestName, coupleName, fonts })
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden.'))),
      'image/png'
    )
  })
}
