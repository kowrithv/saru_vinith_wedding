// @vitest-environment node
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = path.join(process.cwd(), 'scripts/ops/restart-if-unhealthy.sh')

// Ein Ersatz-"docker", der Aufrufe mitschreibt und einen festen Zustand meldet.
function run(status, { notFound = false, name } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'autoheal-'))
  const log = path.join(dir, 'calls.log')
  writeFileSync(
    path.join(dir, 'docker'),
    `#!/bin/sh
echo "$@" >> "${log}"
if [ "$1" = "inspect" ]; then
  ${notFound ? 'exit 1' : `echo "${status}"`}
fi
`
  )
  chmodSync(path.join(dir, 'docker'), 0o755)
  const result = spawnSync('sh', [script, ...(name ? [name] : [])], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    encoding: 'utf8',
  })
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []
  rmSync(dir, { recursive: true, force: true })
  return { ...result, calls }
}

describe('restart-if-unhealthy.sh', () => {
  it('restarts a container whose healthcheck says unhealthy', () => {
    const result = run('unhealthy')
    expect(result.status).toBe(0)
    expect(result.calls.some((c) => c === 'restart saru-vinith-wedding')).toBe(true)
    expect(result.stdout).toMatch(/unhealthy, starte neu/)
  })

  it('leaves a healthy container alone', () => {
    const result = run('healthy')
    expect(result.calls.some((c) => c.startsWith('restart'))).toBe(false)
  })

  it('leaves a container alone that is still starting', () => {
    const result = run('starting')
    expect(result.calls.some((c) => c.startsWith('restart'))).toBe(false)
  })

  it('reports a missing container without failing', () => {
    const result = run('', { notFound: true })
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/nicht gefunden/)
    expect(result.calls.some((c) => c.startsWith('restart'))).toBe(false)
  })

  it('takes the container name as an argument', () => {
    const result = run('unhealthy', { name: 'anderer-name' })
    expect(result.calls).toContain('restart anderer-name')
  })
})
