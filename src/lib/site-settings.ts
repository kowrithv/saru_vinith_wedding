import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultSettings,
  isPageUnlocked,
  pageKeys,
  type PageKey,
  type SiteSettings,
} from '@/lib/site-settings-shared'

export * from '@/lib/site-settings-shared'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'site-settings.json')

export async function readSettings(): Promise<SiteSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<SiteSettings>
    return {
      pages: {
        ...defaultSettings.pages,
        ...parsed.pages,
      },
    }
  } catch {
    return defaultSettings
  }
}

export async function writeSettings(settings: SiteSettings): Promise<void> {
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
}

export async function getVisibilityMap(): Promise<Record<PageKey, boolean>> {
  const settings = await readSettings()
  return pageKeys.reduce((acc, key) => {
    acc[key] = isPageUnlocked(settings.pages[key])
    return acc
  }, {} as Record<PageKey, boolean>)
}
