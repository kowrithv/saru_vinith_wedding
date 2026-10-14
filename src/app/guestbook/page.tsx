'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { MessageSquare, Send, User } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import GuestPasswordField from '@/components/ui/GuestPasswordField'
import { textFieldClassName } from '@/lib/form-styles'
import { useGuestAccess } from '@/lib/use-guest-access'
import { useGuestName } from '@/lib/use-guest-name'
import { cn } from '@/lib/utils'

interface GuestbookEntry {
  id: number
  name: string
  message: string
  createdAt: string
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function GuestbookPage() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
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
    fetch('/api/guestbook')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: GuestbookEntry[] }) => setEntries(data.entries))
      .catch(() => {})
  }, [])

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
                  <p className="text-xs text-gray-400 text-right mt-1">{message.length}/500</p>
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
            {entries.length === 0 && (
              <p className="text-sm text-gray-400">Noch keine Einträge – sei der/die Erste!</p>
            )}
            {entries.map((entry, index) => (
              <Card key={entry.id} className="relative overflow-hidden">
                <span
                  className="absolute -top-3 -left-1 font-serif text-6xl text-gold/10 leading-none pointer-events-none select-none"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <span className="absolute top-4 right-5 font-serif text-xs text-gray-300">
                  #{index + 1}
                </span>
                <div className="flex items-start gap-4 relative">
                  <div className="w-11 h-11 rounded-full bg-champagne text-dark-blue flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {initialsOf(entry.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2 pr-6">
                      <p className="font-semibold text-dark-blue text-sm truncate">{entry.name}</p>
                      <p className="text-xs text-gray-400 flex-shrink-0">{formatDate(entry.createdAt)}</p>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{entry.message}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
