export type PageKey =
  | 'story'
  | 'info'
  | 'gallery'
  | 'quiz'
  | 'faq'
  | 'memories'
  | 'guestbook'
  | 'contact'
  | 'memory-spiel'

export interface PageSetting {
  enabled: boolean
  revealAt: string | null
}

export interface SiteSettings {
  pages: Record<PageKey, PageSetting>
}

export const pageLabels: Record<PageKey, string> = {
  story: 'Unsere Geschichte',
  info: 'Hochzeitsinfos',
  gallery: 'Galerie',
  quiz: 'Quiz',
  faq: 'FAQ',
  memories: 'Erinnerungen',
  guestbook: 'Gästebuch',
  contact: 'Kontakt',
  'memory-spiel': 'Gästespiel (Memory)',
}

export const pageKeys = Object.keys(pageLabels) as PageKey[]

export const defaultSettings: SiteSettings = {
  pages: pageKeys.reduce((acc, key) => {
    acc[key] = { enabled: true, revealAt: null }
    return acc
  }, {} as Record<PageKey, PageSetting>),
}

export function isPageUnlocked(entry: PageSetting): boolean {
  if (!entry.enabled) return false
  if (!entry.revealAt) return true
  return Date.now() >= new Date(entry.revealAt).getTime()
}
