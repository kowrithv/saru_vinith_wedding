// @vitest-environment node
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFakeR2 } from './fake-r2.mjs'

describe('fake R2', () => {
  let root
  let server
  let origin

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'fake-r2-'))
    server = createFakeR2({ root, bucket: 'demo' })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(root, { recursive: true, force: true })
  })

  it('stores a PUT under the key without the bucket and serves it from the public address', async () => {
    const put = await fetch(`${origin}/demo/gallery/a/thumb.jpg?X-Amz-Signature=x`, {
      method: 'PUT',
      body: Buffer.from('fake-jpeg'),
    })
    expect(put.status).toBe(200)
    expect(readFileSync(join(root, 'gallery/a/thumb.jpg'), 'utf8')).toBe('fake-jpeg')

    const get = await fetch(`${origin}/gallery/a/thumb.jpg`)
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toBe('image/jpeg')
    expect(await get.text()).toBe('fake-jpeg')
  })

  it('answers HEAD with the stored size, and 404 for a missing object', async () => {
    await fetch(`${origin}/demo/gallery/a/original.png`, { method: 'PUT', body: Buffer.from('12345') })

    const head = await fetch(`${origin}/demo/gallery/a/original.png`, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('content-length')).toBe('5')

    const missing = await fetch(`${origin}/demo/gallery/none/original.png`, { method: 'HEAD' })
    expect(missing.status).toBe(404)
  })

  it('answers the CORS preflight of a browser upload', async () => {
    const response = await fetch(`${origin}/demo/gallery/a/thumb.jpg`, {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT')
    expect(response.headers.get('access-control-allow-headers')).toBe('content-type')
  })

  it('deletes the keys of a DeleteObjects request', async () => {
    await fetch(`${origin}/demo/gallery/a/thumb.jpg`, { method: 'PUT', body: 'x' })
    await fetch(`${origin}/demo/gallery/a/original.jpg`, { method: 'PUT', body: 'y' })

    const response = await fetch(`${origin}/demo?delete`, {
      method: 'POST',
      body: '<Delete><Object><Key>gallery/a/thumb.jpg</Key></Object><Object><Key>gallery/a/original.jpg</Key></Object></Delete>',
    })
    expect(response.status).toBe(200)
    expect(existsSync(join(root, 'gallery/a/thumb.jpg'))).toBe(false)
    expect(existsSync(join(root, 'gallery/a/original.jpg'))).toBe(false)
  })

  it('never writes outside of its folder', async () => {
    const response = await fetch(`${origin}/demo/..%2F..%2Fescape.txt`, { method: 'PUT', body: 'x' })
    expect(response.status).toBe(400)
    expect(existsSync(join(root, '..', 'escape.txt'))).toBe(false)
  })
})
