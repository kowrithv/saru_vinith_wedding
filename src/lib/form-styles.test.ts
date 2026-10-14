import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { textFieldClassName } from './form-styles'

const FILES_WITH_TEXT_FIELDS = [
  'src/app/memories/page.tsx',
  'src/app/guestbook/page.tsx',
  'src/components/ui/GuestPasswordField.tsx',
  'src/components/gallery/GalleryUploadForm.tsx',
  'src/components/admin/AdminLoginForm.tsx',
]

describe('text field styles', () => {
  it('uses 16 px text so iOS Safari does not zoom in when a field gets focus', () => {
    expect(textFieldClassName).toContain('text-base')
    expect(textFieldClassName).not.toMatch(/\btext-sm\b/)
  })

  it.each(FILES_WITH_TEXT_FIELDS)('%s uses the shared class instead of a 14 px copy', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8')
    expect(source).toContain('textFieldClassName')
    expect(source).not.toContain('outline-none transition-colors text-sm')
  })
})
