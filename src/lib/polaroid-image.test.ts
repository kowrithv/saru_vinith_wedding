import { describe, expect, it } from 'vitest'
import {
  POLAROID_COLORS,
  POLAROID_SIZE,
  drawPolaroid,
  photoCropRect,
  polaroidFileName,
  type PolaroidContext,
} from './polaroid-image'

// Zeichen-Aufzeichnung: prüft, was auf das Bild kommt, ohne echtes Canvas.
function recordingContext() {
  const calls: { fn: string; args: unknown[]; fill?: string }[] = []
  const state = { fillStyle: '' as string, strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '', globalAlpha: 1 }
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop in state) return state[prop as keyof typeof state]
      return (...args: unknown[]) => {
        calls.push({ fn: prop, args, fill: state.fillStyle })
      }
    },
    set(_t, prop: string, value) {
      ;(state as Record<string, unknown>)[prop] = value
      return true
    },
  }
  return { ctx: new Proxy({}, handler) as unknown as PolaroidContext, calls }
}

describe('photoCropRect', () => {
  it('crops a portrait photo to a square, leaning toward the upper part (faces)', () => {
    const rect = photoCropRect(450, 800)
    expect(rect.size).toBe(450)
    expect(rect.x).toBe(0)
    expect(rect.y).toBeGreaterThan(0)
    expect(rect.y + rect.size).toBeLessThanOrEqual(800)
    // näher an oben als in der Mitte
    expect(rect.y).toBeLessThan((800 - 450) / 2)
  })

  it('crops a landscape photo to the centered square', () => {
    const rect = photoCropRect(1600, 900)
    expect(rect).toEqual({ x: 350, y: 0, size: 900 })
  })

  it('keeps a square photo as it is', () => {
    expect(photoCropRect(800, 800)).toEqual({ x: 0, y: 0, size: 800 })
  })
})

describe('polaroidFileName', () => {
  it('builds a safe file name from the guest name', () => {
    expect(polaroidFileName('Lena Müller')).toBe('polaroid-saruga-vinith-lena-muller.png')
  })

  it('falls back when the name has no usable characters', () => {
    expect(polaroidFileName('???')).toBe('polaroid-saruga-vinith.png')
  })
})

describe('drawPolaroid', () => {
  const photo = { width: 800, height: 600 } as CanvasImageSource & { width: number; height: number }
  const fonts = { display: '"Cormorant", serif', script: '"Great Vibes", cursive' }

  it('puts the couple names on a bordeaux banner and the guest name below', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, { photo, guestName: 'Lena', coupleName: 'Saruga & Vinith', fonts })

    const texts = calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0])
    expect(texts).toContain('Saruga & Vinith')
    expect(texts).toContain('Lena')

    const banner = calls.find((c) => c.fn === 'fillRect' && c.fill === POLAROID_COLORS.bordeaux)
    expect(banner).toBeDefined()
  })

  it('draws the photo once, inside the frame', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, { photo, guestName: 'Lena', coupleName: 'Saruga & Vinith', fonts })

    const draws = calls.filter((c) => c.fn === 'drawImage')
    expect(draws).toHaveLength(1)
    const [, , , , , dx, dy, dw, dh] = draws[0].args as number[]
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBeGreaterThan(0)
    expect(dx + dw).toBeLessThan(POLAROID_SIZE.width)
    expect(dw).toBe(dh)
  })

  it('paints the white frame over the whole canvas first', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, { photo, guestName: 'Lena', coupleName: 'Saruga & Vinith', fonts })

    const first = calls.find((c) => c.fn === 'fillRect')
    expect(first?.args).toEqual([0, 0, POLAROID_SIZE.width, POLAROID_SIZE.height])
  })
})
