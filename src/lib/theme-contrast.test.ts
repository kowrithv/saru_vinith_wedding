import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function readToken(css: string, name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`Token --color-${name} nicht gefunden`)
  return match[1]
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('theme tokens', () => {
  const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

  it('keeps text-gold-text readable (WCAG AA, 4.5:1) on white and on the champagne background', () => {
    const goldText = readToken(css, 'gold-text')
    expect(contrast(goldText, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(goldText, readToken(css, 'champagne-light'))).toBeGreaterThanOrEqual(4.5)
  })
})
