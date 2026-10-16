'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { MessageSquare, Send, User } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import GuestPasswordField from '@/components/ui/GuestPasswordField'
import EmptyState from '@/components/ui/EmptyState'
import ShowMoreButton from '@/components/ui/ShowMoreButton'
import NewItemsButton from '@/components/ui/NewItemsButton'
import { textFieldClassName } from '@/lib/form-styles'
import { useGuestAccess } from '@/lib/use-guest-access'
import { useGuestName } from '@/lib/use-guest-name'
import { useLiveList } from '@/lib/use-live-list'
import { cn } from '@/lib/utils'

// So viele Einträge werden auf einmal gezeigt (neueste zuerst), die älteren auf Wunsch.
const PAGE_SIZE = 30

interface GuestbookEntry {
  id: number
  name: string
  message: string
  createdAt: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function GuestbookPage() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  // Laden fehlgeschlagen (Netz, Server): sonst stünde "Noch keine Einträge" da.
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // Der Name wird in allen Formularen nur einmal getippt.
  const { name, setName, remember } = useGuestName()
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const access = useGuestAccess()
  // Das Feld erscheint nur, solange dieser Browser nicht entsperrt ist.
  const needsPassword = access.status === 'locked'

  useEffect(() => {
    let active = true
    fetch('/api/guestbook')
      .then((res) => {
        if (!res.ok) throw new Error('Laden fehlgeschlagen')
        return res.json()
      })
      .then((data: { entries: GuestbookEntry[] }) => {
        if (!active) return
        setEntries(data.entries)
        setLoadFailed(false)
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  // Neue Einträge anderer Gäste erscheinen von selbst (alle 30 Sekunden).
  const live = useLiveList<GuestbookEntry>({
    url: '/api/guestbook',
    shown: entries,
    enabled: !loadFailed,
    keyOf: (entry) => String(entry.id),
    parse: (body) => {
      const list = (body as { entries?: unknown } | null)?.entries
      return Array.isArray(list) ? (list as GuestbookEntry[]) : null
    },
    onApply: setEntries,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedMessage = message.trim()
    if (!name.trim()) {
      setError('Bitte gib deinen Namen ein.')
      return
    }
    if (trimmedMessage.length < 10) {
      setError('Deine Nachricht ist zu kurz. Bitte schreib mindestens 10 Zeichen.')
      return
    }
    if (needsPassword && !password.trim()) {
      setError('Bitte gib das Kennwort vom Empfang ein.')
      return
    }

    remember(name)
    setSubmitting(true)
    try {
      const response = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          message: trimmedMessage,
          ...(needsPassword ? { password } : {}),
        }),
      })
      if (response.status === 401) {
        // Mit Kennwort: vertippt. Ohne: die gemerkte Sitzung gilt nicht mehr
        // (abgelaufen oder Kennwort gewechselt) - das Feld wieder zeigen.
        setError(needsPassword ? 'Falsches Kennwort.' : 'Bitte gib das Kennwort vom Empfang ein.')
        access.markLocked()
        return
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'Eintrag konnte nicht gespeichert werden. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { entry: GuestbookEntry }
      setEntries((prev) => [data.entry, ...prev])
      setMessage('')
      setPassword('')
      // Der Server hat mit dem richtigen Kennwort die Sitzung gesetzt.
      if (needsPassword) access.markUnlocked()
    } catch {
      setError('Eintrag konnte nicht gespeichert werden. Bitte versuch es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Gästebuch"
          subtitle="Hinterlasst uns eine Nachricht, einen Wunsch oder eine Erinnerung – für immer in unserem Herzen."
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <Card padding="lg" className="sticky top-24">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-dark-blue rounded-xl flex items-center justify-center">
                  <MessageSquare size={18} className="text-white" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-dark-blue">Eintrag hinterlassen</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="guestbook-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    <User size={14} className="inline mr-1" />
                    Dein Name
                  </label>
                  <input
                    id="guestbook-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Wie heißt du?"
                    maxLength={60}
                    className={textFieldClassName}
                  />
                </div>

                <div>
                  <label htmlFor="guestbook-message" className="block text-sm font-medium text-gray-700 mb-1.5">
                    <MessageSquare size={14} className="inline mr-1" />
                    Deine Nachricht
                  </label>
                  <textarea
                    id="guestbook-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Schreib dem Brautpaar eine Nachricht, einen Wunsch oder eine nette Erinnerung..."
                    rows={5}
                    maxLength={500}
                    className={cn(textFieldClassName, 'resize-none')}
                  />
                  <p className="text-xs text-gray-500 text-right mt-1">{message.length}/500</p>
                </div>

                {needsPassword && (
                  <GuestPasswordField
                    id="guestbook-password"
                    value={password}
                    onChange={setPassword}
                    linkRejected={access.linkRejected}
                  />
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" size="lg" disabled={submitting} className="w-full">
                  <Send size={16} />
                  {submitting ? 'Wird eingetragen...' : 'Ins Gästebuch eintragen'}
                </Button>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <NewItemsButton count={live.newCount} singular="neuer Eintrag" plural="neue Einträge" onClick={live.showNew} />
            {loadFailed && entries.length === 0 && (
              <EmptyState
                title="Die Einträge konnten nicht geladen werden"
                description="Bitte versuch es noch einmal."
                action={
                  <button
                    type="button"
                    onClick={() => setReloadKey((key) => key + 1)}
                    className="rounded-full border-2 border-dark-blue px-6 py-2.5 text-sm font-medium text-dark-blue transition-colors hover:bg-dark-blue hover:text-white"
                  >
                    Erneut versuchen
                  </button>
                }
              />
            )}
            {!loadFailed && entries.length === 0 && (
              <EmptyState title="Noch keine Einträge" description="Sei der oder die Erste, die dem Brautpaar schreibt." />
            )}
            {entries.slice(0, visibleCount).map((entry) => (
              <Card key={entry.id} variant="ornate" className="relative overflow-hidden">
                <p className="font-display text-xl italic leading-snug text-dark-blue md:text-2xl">{entry.message}</p>
                <div className="mt-4 text-right">
                  <p className="truncate font-script text-3xl leading-none text-dark-blue">{entry.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-gray-600">{formatDate(entry.createdAt)}</p>
                </div>
              </Card>
            ))}
            {entries.length > visibleCount && (
              <ShowMoreButton
                key={visibleCount}
                label={`${Math.min(PAGE_SIZE, entries.length - visibleCount)} ältere Einträge anzeigen`}
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
