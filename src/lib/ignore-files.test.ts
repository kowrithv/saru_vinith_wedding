import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Die Sicherungen enthalten Gästedaten, Löschtoken-Hashes und das Admin-Secret.
// Das Repo ist öffentlich und das Docker-Build-Verzeichnis wird mit COPY . .
// übernommen - beide Ignore-Dateien müssen den Ordner kennen.
describe('backup folder is never committed or sent into the Docker build', () => {
  it.each(['.gitignore', '.dockerignore'])('%s ignores data/backups/', (file) => {
    const lines = readFileSync(path.join(process.cwd(), file), 'utf8').split('\n').map((line) => line.trim())
    expect(lines).toContain('data/backups/')
  })
})
