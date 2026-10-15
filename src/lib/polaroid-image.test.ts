import { describe, expect, it } from 'vitest'
import {
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
      // Breite wächst mit der Schriftgröße wie bei einer echten Schrift.
      if (prop === 'measureText') {
        return (text: string) => ({ width: text.length * Number(/(\d+)px/.exec(state.font)?.[1] ?? 20) * 0.5 })
      }
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
  const aspect = { width: 880, height: 1000 }

  it('crops a portrait photo to the frame, leaning toward the upper part (faces)', () => {
    const rect = photoCropRect(450, 800, aspect)
    expect(rect.width).toBe(450)
    expect(rect.height).toBe(Math.round(450 / 0.88))
    expect(rect.x).toBe(0)
    // näher an oben als in der Mitte
    expect(rect.y).toBeGreaterThan(0)
    expect(rect.y).toBeLessThan((800 - rect.height) / 2)
    expect(rect.y + rect.height).toBeLessThanOrEqual(800)
  })

  it('crops a landscape photo to the centered portrait section', () => {
    const rect = photoCropRect(1600, 900, aspect)
    expect(rect.height).toBe(900)
    expect(rect.width).toBe(Math.round(900 * 0.88))
    expect(rect.x).toBe(Math.round((1600 - rect.width) / 2))
    expect(rect.y).toBe(0)
  })

  it('keeps the whole width of a square photo and crops its height', () => {
    const rect = photoCropRect(800, 800, aspect)
    expect(rect.height).toBe(800)
    expect(rect.width).toBe(Math.round(800 * 0.88))
  })

  it('never reaches outside of the photo', () => {
    for (const [w, h] of [
      [450, 800],
      [1600, 900],
      [800, 800],
      [3000, 4000],
      [100, 1000],
    ]) {
      const rect = photoCropRect(w, h, aspect)
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(w)
      expect(rect.y + rect.height).toBeLessThanOrEqual(h)
    }
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
  const fonts = { display: '"Cormorant", serif', serif: '"Playfair Display", serif', script: '"Great Vibes", cursive' }
  const base = {
    photo,
    guestName: 'Lena',
    coupleName: 'Saruga & Vinith',
    occasion: 'Standesamtliche Hochzeit',
    date: '17.10.2026',
    fonts,
  }

  // Die gesperrte Schrift wird Zeichen für Zeichen gesetzt: zum Prüfen alle
  // gezeichneten Texte ohne Leerzeichen aneinanderhängen.
  function writtenText(calls: { fn: string; args: unknown[] }[]): string {
    return calls
      .filter((c) => c.fn === 'fillText')
      .map((c) => String(c.args[0]))
      .join('')
      .replace(/\s/g, '')
  }

  it('is a 2:3 portrait like the example', () => {
    expect(POLAROID_SIZE.height / POLAROID_SIZE.width).toBeCloseTo(1.5, 2)
  })

  it('writes the occasion, the names, the date and the guest', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, base)

    const text = writtenText(calls)
    expect(text).toContain('STANDESAMTLICHEHOCHZEIT')
    expect(text).toContain('Saruga&Vinith')
    expect(text).toContain('17.10.2026')
    expect(text).toContain('ERINNERUNGVONLENA')
  })

  it('sets the couple names in the script font and the rest in the serif font', () => {
    const { ctx, calls } = recordingContext()
    const fontsSeen: { text: string; font: string }[] = []
    let currentFont = ''
    const proxy = new Proxy(ctx as object, {
      set(target, prop, value) {
        if (prop === 'font') currentFont = String(value)
        return Reflect.set(target, prop, value)
      },
      get(target, prop) {
        if (prop === 'fillText') {
          return (text: string, ...rest: unknown[]) => {
            fontsSeen.push({ text, font: currentFont })
            return (target as Record<string, (...a: unknown[]) => unknown>).fillText(text, ...rest)
          }
        }
        return Reflect.get(target, prop)
      },
    }) as unknown as PolaroidContext
    drawPolaroid(proxy, base)

    // Namen in Schreibschrift, das "&" dazwischen mit eigenem Abstand
    expect(fontsSeen.find((entry) => entry.text === 'Saruga')?.font).toContain('Great Vibes')
    expect(fontsSeen.find((entry) => entry.text === '&')?.font).toContain('Great Vibes')
    expect(fontsSeen.find((entry) => entry.text === 'Vinith')?.font).toContain('Great Vibes')
    // Anlass in Cormorant, das Datum in Playfair (gerade Ziffern statt Mediäval-Ziffern)
    expect(fontsSeen.find((entry) => entry.text === 'S')?.font).toContain('Cormorant')
    expect(fontsSeen.find((entry) => entry.text === '1')?.font).toContain('Playfair')
    expect(calls.length).toBeGreaterThan(0)
  })

  it('has no bordeaux banner and no flowers by default', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, base)

    expect(calls.find((c) => c.fn === 'fillRect' && c.fill === '#7a2432')).toBeUndefined()
    expect(calls.filter((c) => c.fn === 'ellipse')).toHaveLength(0)
  })

  it('can bring the corner flowers back', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, { ...base, withFlowers: true })
    expect(calls.filter((c) => c.fn === 'ellipse').length).toBeGreaterThan(0)
  })

  it('draws the photo once, inside the paper, as a portrait', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, base)

    const draws = calls.filter((c) => c.fn === 'drawImage')
    expect(draws).toHaveLength(1)
    const [, , , , , dx, dy, dw, dh] = draws[0].args as number[]
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBeGreaterThan(0)
    expect(dx + dw).toBeLessThan(POLAROID_SIZE.width)
    expect(dh).toBeGreaterThan(dw)
    // Der Text darunter braucht Platz: das Foto endet im oberen Drittel Dreiviertel.
    expect(dy + dh).toBeLessThan(POLAROID_SIZE.height * 0.75)
  })

  it('draws the paper with rounded corners instead of a plain rectangle', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, base)

    const corners = calls.filter((c) => c.fn === 'arc')
    expect(corners.length).toBeGreaterThanOrEqual(4)
    const fullRect = calls.find(
      (c) => c.fn === 'fillRect' && c.args[2] === POLAROID_SIZE.width && c.args[3] === POLAROID_SIZE.height
    )
    expect(fullRect).toBeUndefined()
  })

  it('finishes with two thin lines and a heart between them', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, base)

    const thin = calls.filter((c) => c.fn === 'fillRect' && (c.args[3] as number) <= 3)
    expect(thin).toHaveLength(2)
    expect(calls.some((c) => c.fn === 'bezierCurveTo')).toBe(true)
  })

  it('shrinks a very long guest name to fit instead of running off the paper', () => {
    const { ctx, calls } = recordingContext()
    drawPolaroid(ctx, { ...base, guestName: 'Maximiliane-Charlotte von und zu Hohenlohe-Langenburg' })

    const letters = calls.filter((c) => c.fn === 'fillText' && String(c.args[0]).length === 1)
    const xs = letters.map((c) => c.args[1] as number)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThanOrEqual(POLAROID_SIZE.width)
  })
})
