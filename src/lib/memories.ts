import { promises as fs } from 'fs'
import path from 'path'
import { generateId } from '@/lib/utils'
import type { Memory } from '@/types'

const DATA_FILE = path.join(process.cwd(), 'data', 'memories.json')

export async function readMemories(): Promise<Memory[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeMemories(memories: Memory[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(memories, null, 2) + '\n', 'utf-8')
}

export interface NewMemoryInput {
  name: string
  type: Memory['type']
  content: string
  mediaUrl?: string
}

export async function addMemory(input: NewMemoryInput): Promise<Memory> {
  const entry: Memory = {
    id: generateId(),
    name: input.name,
    type: input.type,
    content: input.content,
    mediaUrl: input.mediaUrl,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  }

  const memories = await readMemories()
  await writeMemories([entry, ...memories])
  return entry
}
