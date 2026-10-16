// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
// Ohne Kommentarzeilen: sie erklären die Wahl und dürfen die Namen nennen.
const lines = workflow.split('\n').filter((line) => !line.trim().startsWith('#'))

describe('CI workflow', () => {
  // ubuntu-latest zeigt ab dem 19.10.2026 auf Ubuntu 26: ein Image-Build am
  // Hochzeitstag soll nicht auf einem neuen System laufen.
  it('pins the runner instead of following ubuntu-latest', () => {
    const runners = lines.filter((line) => /^\s*runs-on:/.test(line))
    expect(runners.length).toBeGreaterThanOrEqual(3)
    for (const runner of runners) {
      expect(runner).toMatch(/runs-on:\s*ubuntu-24\.04\s*$/)
    }
    expect(lines.join('\n')).not.toContain('ubuntu-latest')
  })

  it('uses checkout and setup-node versions built for Node 24', () => {
    const uses = lines.filter((line) => /uses:\s*actions\/(checkout|setup-node)@/.test(line))
    expect(uses.length).toBeGreaterThanOrEqual(3)
    for (const line of uses) {
      expect(line).not.toMatch(/@v[0-4]\b/)
    }
  })

  // Der Produktions-Tag der alten Seite (clean-start/latest) darf nie von dieser
  // Pipeline verschoben werden.
  it('never tags the image as latest', () => {
    expect(lines.join('\n')).toMatch(/flavor:\s*\|\s*\n\s*latest=false/)
  })

  it('builds the image only for version tags', () => {
    expect(lines.join('\n')).toContain("startsWith(github.ref, 'refs/tags/v')")
  })
})
