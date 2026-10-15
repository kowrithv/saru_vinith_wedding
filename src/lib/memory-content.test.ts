// @vitest-environment node
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { MEMORY_PAIRS_COUNT, memoryImages } from './memory-content'

const publicDir = path.join(process.cwd(), 'public')

// Die Karten sind höchstens ca. 170 px breit: große Dateien würden auf dem
// Handy nur Datenvolumen kosten (das Spiel lädt alle Bilder, zeigt 8).
describe('memory images', () => {
  it('has at least as many images as pairs', () => {
    expect(memoryImages.length).toBeGreaterThanOrEqual(MEMORY_PAIRS_COUNT)
  })

  it.each(memoryImages)('%s exists, is a small square', async (url) => {
    const file = path.join(publicDir, url)
    expect(existsSync(file), `${url} fehlt`).toBe(true)
    expect(statSync(file).size).toBeLessThanOrEqual(45 * 1024)
    const { width, height } = await sharp(file).metadata()
    expect(width).toBe(height)
    expect(width).toBeLessThanOrEqual(480)
  })
})
