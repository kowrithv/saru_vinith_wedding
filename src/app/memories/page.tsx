'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Heart, KeyRound, Send, User } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface MemoryEntry {
  id: number
  name: string
  message: string
  photoKey: string | null
  createdAt: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MemoriesPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/memories')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: MemoryEntry[] }) => setEntries(data.entries))
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
      setError('Deine Erinnerung ist zu kurz. Bitte schreib mindestens 10 Zeichen.')
      return
    }
    if (!password) {
      setError('Bitte gib das Kennwort vom Empfang ein.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), message: trimmedMessage, password }),
      })
      if (response.status === 401) {
        setError('Falsches Kennwort.')
        return
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'Erinnerung konnte nicht gespeichert werden. Bitte versuch es erneut.')
        return
      }
      const data = (await response.json()) as { entry: MemoryEntry }
      setEntries((prev) => [data.entry, ...prev])
      setName('')
      setMessage('')
      setPassword('')
    } catch {
      setError('Erinnerung konnte nicht gespeichert werden. Bitte versuch es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <SectionTitle
          title="Erinnerungen"
          subtitle="Nur mit dem Kennwort vom Empfang: teilt eure Erinnerungen an uns und diesen Tag."
        />

        <Card padding="lg" className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-dark-blue rounded-xl flex items-center justify-center">
              <Heart size={18} className="text-white" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-dark-blue">Erinnerung teilen</h3>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="memories-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                <User size={14} className="inline mr-1" />
                Dein Name
              </label>
              <input
                id="memories-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wie heißt du?"
                maxLength={60}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
              />
            </div>

            <div>
              <label htmlFor="memories-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                <KeyRound size={14} className="inline mr-1" />
                Kennwort vom Empfang
              </label>
              <input
                id="memories-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kennwort"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="memories-message" className="block text-sm font-medium text-gray-700 mb-1.5">
                <Heart size={14} className="inline mr-1" />
                Deine Erinnerung
              </label>
              <textarea
                id="memories-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ein Moment, ein Lachen, ein Satz – was bleibt dir von diesem Tag?"
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{message.length}/500</p>
            </div>

            {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}

            <div className="md:col-span-2">
              <Button type="submit" size="lg" disabled={submitting} className="w-full">
                <Send size={16} />
                {submitting ? 'Wird geteilt...' : 'Erinnerung teilen'}
              </Button>
            </div>
          </form>
        </Card>

        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center">Noch keine Erinnerungen – teilt eure erste!</p>
        ) : (
          <div className="columns-1 md:columns-2 gap-4">
            {entries.map((entry) => (
              <Card
                key={entry.id}
                variant="champagne"
                className="relative overflow-hidden mb-4 break-inside-avoid"
              >
                <span
                  className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-dashed border-champagne-dark rounded-tl-lg pointer-events-none"
                  aria-hidden="true"
                />
                <div className="flex items-start gap-3 mb-2 pl-2">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                    <Heart size={16} className="text-dark-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-dark-blue truncate">{entry.name}</p>
                    <p className="text-xs text-gray-500">{formatDate(entry.createdAt)}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed italic pl-2">&quot;{entry.message}&quot;</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
