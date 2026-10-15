import { describe, expect, it } from 'vitest'
import { vendors } from './vendors'

describe('vendors', () => {
  it('lists the six service providers in the order given by the couple', () => {
    expect(vendors.map((vendor) => vendor.name)).toEqual([
      'Optimeye',
      'MP Designs',
      'Nandys',
      'DJ Tastic',
      'Bubble BAS',
      'Begegnungsstätte Niederkrüchten',
    ])
  })

  it('links without the tracking parameters of the share links', () => {
    vendors.forEach((vendor) => {
      const url = new URL(vendor.href)
      expect(url.protocol).toBe('https:')
      expect(url.search).toBe('')
    })
  })

  it('points to the Instagram profiles and the website of the venue', () => {
    expect(vendors[0].href).toBe('https://www.instagram.com/optimeye')
    expect(vendors[3].href).toBe('https://www.instagram.com/djtastic_de')
    expect(vendors[5].href).toBe('https://www.reservierungen-niederkruechten.de/begegnungsstaette.html')
  })
})
