// Ersatz für R2 zum lokalen Testen (siehe README, "Ohne R2 testen"): nimmt
// presigned PUTs an, beantwortet HEAD und löscht Objekte. Gespeichert wird in
// einem Ordner; derselbe Server liefert die Dateien auch aus
// (R2_PUBLIC_BASE_URL zeigt auf ihn). Prüft KEINE Signaturen - nur zum
// Ausprobieren, nie öffentlich erreichbar machen.
import { createServer } from 'node:http'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve, sep } from 'node:path'

const CONTENT_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.heic', 'image/heic'],
])

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolveBody(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

export function createFakeR2({ root, bucket = 'demo' }) {
  const base = resolve(root)

  // Pfad-Adressierung (/<bucket>/<key>) und die öffentliche Adresse (/<key>).
  function fileFor(pathname) {
    let key = decodeURIComponent(pathname).replace(/^\/+/, '')
    if (key.startsWith(`${bucket}/`)) key = key.slice(bucket.length + 1)
    if (!key) return null
    const file = normalize(join(base, key))
    return file.startsWith(base + sep) ? file : null
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Expose-Headers', 'ETag')

    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET, PUT, HEAD, DELETE, POST',
          'Access-Control-Allow-Headers': request.headers['access-control-request-headers'] ?? '*',
          'Access-Control-Max-Age': '600',
        })
        response.end()
        return
      }

      // DeleteObjects: POST /<bucket>?delete mit einer XML-Liste der Schlüssel.
      if (request.method === 'POST' && url.searchParams.has('delete')) {
        const xml = (await readBody(request)).toString('utf8')
        for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
          const file = fileFor(`/${match[1]}`)
          if (file) await rm(file, { force: true })
        }
        response.writeHead(200, { 'Content-Type': 'application/xml' })
        response.end('<?xml version="1.0" encoding="UTF-8"?><DeleteResult></DeleteResult>')
        return
      }

      const file = fileFor(url.pathname)
      if (!file) {
        response.writeHead(400)
        response.end('Bad Request')
        return
      }

      if (request.method === 'PUT') {
        const body = await readBody(request)
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, body)
        response.writeHead(200, { ETag: `"${body.length}"` })
        response.end()
        return
      }

      if (request.method === 'DELETE') {
        await rm(file, { force: true })
        response.writeHead(204)
        response.end()
        return
      }

      if (request.method === 'GET' || request.method === 'HEAD') {
        const info = await stat(file).catch(() => null)
        if (!info?.isFile()) {
          response.writeHead(404)
          response.end('Not Found')
          return
        }
        const extension = file.slice(file.lastIndexOf('.')).toLowerCase()
        response.writeHead(200, {
          'Content-Type': CONTENT_TYPES.get(extension) ?? 'application/octet-stream',
          'Content-Length': info.size,
          'Cache-Control': 'no-store',
        })
        response.end(request.method === 'HEAD' ? undefined : await readFile(file))
        return
      }

      response.writeHead(405)
      response.end('Method Not Allowed')
    } catch {
      response.writeHead(500)
      response.end('Internal Server Error')
    }
  })
}
