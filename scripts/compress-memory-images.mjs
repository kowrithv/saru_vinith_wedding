import sharp from 'sharp'
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_DIR = process.argv[2] ?? '/tmp/memory-originals'
const TARGET_DIR = path.join(process.cwd(), 'public', 'memory-spiel')
const MAX_DIMENSION = 800
const MAX_BYTES = 100 * 1024

async function compressOne(file) {
  const sourcePath = path.join(SOURCE_DIR, file)
  const targetPath = path.join(TARGET_DIR, file)

  let quality = 80
  let buffer = await sharp(sourcePath)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .rotate()
    .jpeg({ quality })
    .toBuffer()

  while (buffer.length > MAX_BYTES && quality > 30) {
    quality -= 10
    buffer = await sharp(sourcePath)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .rotate()
      .jpeg({ quality })
      .toBuffer()
  }

  await writeFile(targetPath, buffer)
  console.log(`${file}: ${buffer.length} bytes (quality ${quality})`)
}

async function main() {
  await mkdir(TARGET_DIR, { recursive: true })
  const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith('.jpg'))
  for (const file of files) {
    await compressOne(file)
  }
}

main()
