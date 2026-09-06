'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { LogOut, Save, Clock, X, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import WhoGameAdmin from '@/components/admin/WhoGameAdmin'
import { cn } from '@/lib/utils'
import {
  pageKeys,
  pageLabels,
  isPageUnlocked,
  type SiteSettings,
  type PageKey,
} from '@/lib/site-settings-shared'
import type { WhoGameData } from '@/lib/who-game'

interface AdminDashboardProps {
  initialSettings: SiteSettings
  initialWhoGameData: WhoGameData
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

export default function AdminDashboard({ initialSettings, initialWhoGameData }: AdminDashboardProps) {
  const router = useRouter()
  const [settings, setSettings] = useState<SiteSettings>(initialSettings)
  const [isSaving, setIsSaving] = useState(false)

  const toggleEnabled = (key: PageKey) => {
    setSettings((prev) => ({
      pages: {
        ...prev.pages,
        [key]: { ...prev.pages[key], enabled: !prev.pages[key].enabled },
      },
    }))
  }

  const setRevealAt = (key: PageKey, value: string) => {
    setSettings((prev) => ({
      pages: {
        ...prev.pages,
        [key]: { ...prev.pages[key], revealAt: fromDatetimeLocalValue(value) },
      },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!response.ok) {
        toast.error('Speichern fehlgeschlagen.')
        return
      }
      toast.success('Einstellungen gespeichert! 💾')
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-champagne-light/20 to-white pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <SectionTitle
              title="Admin"
              subtitle="Blendet Seiten ein/aus oder plant eine automatische Freischaltung."
              centered={false}
              className="mb-0 flex-1"
            />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="mt-1">
              <LogOut size={14} />
              Abmelden
            </Button>
          </div>

          <div className="space-y-3 mt-8">
            {pageKeys.map((key) => {
              const entry = settings.pages[key]
              const unlocked = isPageUnlocked(entry)
              const hasSchedule = Boolean(entry.revealAt)

              return (
                <Card key={key} padding="md">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-serif text-lg font-semibold text-dark-blue">
                          {pageLabels[key]}
                        </h3>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                            unlocked
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                          )}
                        >
                          {unlocked ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {unlocked ? 'Live' : entry.enabled ? 'Geplant' : 'Ausgeblendet'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">/{key}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400 flex-shrink-0" />
                      <input
                        type="datetime-local"
                        value={toDatetimeLocalValue(entry.revealAt)}
                        onChange={(e) => setRevealAt(key, e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none"
                      />
                      {hasSchedule && (
                        <button
                          type="button"
                          onClick={() => setRevealAt(key, '')}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          aria-label="Freischaltzeitpunkt entfernen"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={entry.enabled}
                      onClick={() => toggleEnabled(key)}
                      className={cn(
                        'relative w-12 h-7 rounded-full transition-colors flex-shrink-0',
                        entry.enabled ? 'bg-dark-blue' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                          entry.enabled && 'translate-x-5'
                        )}
                      />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="mt-8 flex justify-end">
            <Button variant="primary" size="lg" onClick={handleSave} disabled={isSaving}>
              <Save size={16} />
              {isSaving ? 'Speichert...' : 'Speichern'}
            </Button>
          </div>

          <WhoGameAdmin initialData={initialWhoGameData} />
        </motion.div>
      </div>
    </div>
  )
}
