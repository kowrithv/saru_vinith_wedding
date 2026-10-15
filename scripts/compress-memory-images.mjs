import sharp from 'sharp'
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_DIR = process.argv[2] ?? '/tmp/memory-originals'
const TARGET_DIR = path.join(process.cwd(), 'public', 'memory-spiel')
// Die Karten im Spiel sind höchstens ca. 170 px breit und zeigen einen
// quadratischen Ausschnitt (object-cover, Mitte): 400 x 400 px genügen auch auf
// Retina-Displays und sind etwa 20 KB groß.
const SIZE = 400
const MAX_BYTES = 40 * 1024

async function compressOne(file) {
  const sourcePath = path.join(SOURCE_DIR, file)
  const targetPath = path.join(TARGET_DIR, file)

  let quality = 80
  let buffer = await sharp(sourcePath)
    .rotate()
    .resize({ width: SIZE, height: SIZE, fit: 'cover', position: 'centre' })
    .jpeg({ quality })
    .toBuffer()

  while (buffer.length > MAX_BYTES && quality > 30) {
    quality -= 10
    buffer = await sharp(sourcePath)
      .rotate()
      .resize({ width: SIZE, height: SIZE, fit: 'cover', position: 'centre' })
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
