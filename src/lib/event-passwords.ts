// Jedes Event hat ein eigenes Kennwort, das die Gäste bei der Einladung erhalten.
// Ein Foto-Upload mit diesem Kennwort wird automatisch der passenden Kategorie zugeordnet.
// Kennwörter in .env.local setzen: UPLOAD_PASSWORD_STANDESAMT / UPLOAD_PASSWORD_EMPFANG
import { uploadCategories } from '@/lib/upload-categories'

interface EventPasswordEntry {
  password: string | undefined
  category: string
}

const EVENTS: EventPasswordEntry[] = [
  { password: process.env.UPLOAD_PASSWORD_STANDESAMT, category: uploadCategories[0] },
  { password: process.env.UPLOAD_PASSWORD_EMPFANG, category: uploadCategories[1] },
]

export function resolveCategoryFromPassword(password: string): string | null {
  const trimmed = password.trim()
  if (!trimmed) return null
  const match = EVENTS.find((e) => e.password && e.password === trimmed)
  return match ? match.category : null
}
