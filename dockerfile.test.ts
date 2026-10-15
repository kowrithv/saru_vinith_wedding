// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dockerfile = readFileSync('Dockerfile', 'utf8')
// Ohne Kommentarzeilen: sie erklären das Problem und dürfen die Wörter nennen.
const instructions = dockerfile
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n')

describe('Dockerfile', () => {
  // Das Alpine-Image hat weder Python noch einen Compiler: ein Install-Skript, das
  // `node-gyp rebuild` startet (better-sqlite3), ließ den ersten Image-Build von
  // v1.0.0-rc.1 scheitern. Die mitgelieferten Binärdateien reichen.
  it('installs the dependencies without running install scripts', () => {
    const install = dockerfile.split('\n').find((line) => /^RUN npm ci\b/.test(line))
    expect(install).toBeDefined()
    expect(install).toContain('--ignore-scripts')
  })

  it('does not pull in a compiler toolchain for the database', () => {
    expect(instructions).not.toMatch(/node-gyp|apk add[^\n]*(python|g\+\+|make)/)
  })
})
