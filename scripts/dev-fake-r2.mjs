// Startet den Ersatz-R2-Server (scripts/lib/fake-r2.mjs).
//   node scripts/dev-fake-r2.mjs [Ordner] [Port] [Bucket]
// Standard: ./data/fake-r2 auf Port 3199, Bucket "demo".
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createFakeR2 } from './lib/fake-r2.mjs'

const root = resolve(process.argv[2] ?? 'data/fake-r2')
const port = Number(process.argv[3] ?? 3199)
const bucket = process.argv[4] ?? 'demo'

mkdirSync(root, { recursive: true })
createFakeR2({ root, bucket }).listen(port, '127.0.0.1', () => {
  console.log(`Ersatz-R2 auf http://127.0.0.1:${port} (Bucket "${bucket}", Ordner ${root})`)
  console.log(`In der App: R2_ENDPOINT=http://127.0.0.1:${port}  R2_PUBLIC_BASE_URL=http://127.0.0.1:${port}  R2_BUCKET_NAME=${bucket}`)
})
