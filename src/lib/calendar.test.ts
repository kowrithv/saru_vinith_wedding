import { describe, expect, it } from 'vitest'
import { buildEventIcs, escapeIcsText, foldIcsLine } from './calendar'

describe('escapeIcsText', () => {
  it('escapes commas, semicolons, backslashes and line breaks', () => {
    expect(escapeIcsText('a, b; c\\d\ne')).toBe('a\\, b\; c\\\\d\\ne')
  })
})

describe('foldIcsLine', () => {
  it('keeps short lines as they are', () => {
    expect(foldIcsLine('SUMMARY:Kurz')).toBe('SUMMARY:Kurz')
  })

  it('folds long lines at 75 characters with a leading space on the continuation', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'x'.repeat(200)}`)
    const lines = folded.split('\r\n')
    expect(lines.length).toBeGreaterThan(1)
    lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(75))
    lines.slice(1).forEach((line) => expect(line.startsWith(' ')).toBe(true))
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'x'.repeat(200)}`)
  })
})

describe('buildEventIcs', () => {
  const ics = buildEventIcs(new Date('2026-10-01T10:00:00Z'))

  it('is a calendar with exactly one event, CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).not.toMatch(/[^\r]\n/)
  })

  it('starts at 16:30 German time, written in UTC so every device agrees', () => {
    expect(ics).toContain('DTSTART:20261017T143000Z')
  })

  it('carries a stable id, the place and the coordinates', () => {
    // Lange Zeilen sind gefaltet; das Lesegerät setzt sie wieder zusammen.
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('UID:hochzeit-2026-10-17@vsjourney.de')
    expect(unfolded).toContain('LOCATION:Begegnungsstätte Niederkrüchten\\, Oberkrüchtener Weg 42\\, 41372 Niederkrüchten')
    expect(unfolded).toContain('GEO:51.196771;6.213148')
  })

  it('names the couple in the title', () => {
    expect(ics).toContain('SUMMARY:Hochzeit Saruga & Vinith')
  })

  it('stamps the file with the generation time', () => {
    expect(ics).toContain('DTSTAMP:20261001T100000Z')
  })
})
