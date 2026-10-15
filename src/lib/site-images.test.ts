// @vitest-environment node
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { couple } from './site-content'
import { heroPhoto, homePreviewPhotos, whoPortraits } from './site-images'

const publicDir = path.join(process.cwd(), 'public')

describe('hero photo', () => {
  it('exists, is a portrait and stays small enough for a phone', async () => {
    const file = path.join(publicDir, heroPhoto)
    expect(existsSync(file), `${heroPhoto} fehlt`).toBe(true)
    expect(statSync(file).size).toBeLessThanOrEqual(200 * 1024)
    const { width, height } = await sharp(file).metadata()
    expect(height).toBeGreaterThan(width ?? 0)
    // Der Bogenrahmen ist ca. 290 px hoch: doppelte Auflösung genügt.
    expect(width).toBeGreaterThanOrEqual(600)
  })
})

describe('home preview photos', () => {
  it('has four of them', () => {
    expect(homePreviewPhotos).toHaveLength(4)
  })

  it.each(homePreviewPhotos)('%s exists, is square and tiny', async (url) => {
    const file = path.join(publicDir, url)
    expect(existsSync(file), `${url} fehlt`).toBe(true)
    expect(statSync(file).size).toBeLessThanOrEqual(15 * 1024)
    const { width, height } = await sharp(file).metadata()
    expect(width).toBe(height)
    expect(width).toBeLessThanOrEqual(240)
  })
})

describe('static map', () => {
  it('exists and stays small', () => {
    const file = path.join(publicDir, 'info/karte.jpg')
    expect(existsSync(file), 'info/karte.jpg fehlt').toBe(true)
    expect(statSync(file).size).toBeLessThanOrEqual(200 * 1024)
  })
})

describe('who portraits', () => {
  it('has one for each of the two people', () => {
    expect([...whoPortraits.keys()].sort()).toEqual([couple.bride, couple.groom].sort())
  })

  it.each([...whoPortraits.entries()])('%s exists, is square and small', async (_name, url) => {
    const file = path.join(publicDir, url)
    expect(existsSync(file), `${url} fehlt`).toBe(true)
    expect(statSync(file).size).toBeLessThanOrEqual(30 * 1024)
    const { width, height } = await sharp(file).metadata()
    expect(width).toBe(height)
    expect(width).toBeLessThanOrEqual(256)
  })
})
