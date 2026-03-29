'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, Heart, User } from 'lucide-react'
import toast from 'react-hot-toast'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { mockGuestbookEntries } from '@/lib/config'
import { GuestbookEntry } from '@/types'
import { generateId } from '@/lib/utils'

const STORAGE_KEY = 'saru_vinith_guestbook'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function EntryCard({ entry }: { entry: GuestbookEntry }) {
  const initials = entry.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const colors = [
    'bg-champagne text-dark-blue',
    'bg-baby-blue text-dark-blue',
    'bg-dark-blue text-white',
    'bg-gold/20 text-gold-dark',
  ]
  const colorIndex = entry.name.charCodeAt(0) % colors.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
    >
      <Card className="hover:shadow-md transition-shadow duration-200">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${colors[colorIndex]}`}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-semibold text-dark-blue text-sm truncate">{entry.name}</p>
              <p className="text-xs text-gray-400 flex-shrink-0">
                {new Date(entry.createdAt).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{entry.message}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default function GuestbookPage() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setEntries(JSON.parse(stored))
      } catch {
        setEntries(mockGuestbookEntries)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mockGuestbookEntries))
      }
    } else {
      setEntries(mockGuestbookEntries)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockGuestbookEntries))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Bitte gib deinen Namen ein.')
      return
    }
    if (!message.trim()) {
      toast.error('Bitte schreib eine Nachricht.')
      return
    }
    if (message.trim().length < 10) {
      toast.error('Deine Nachricht ist zu kurz. Bitte schreib mindestens 10 Zeichen.')
      return
    }

    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 700))

    const newEntry: GuestbookEntry = {
      id: generateId(),
      name: name.trim(),
      message: message.trim(),
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    }

    const updated = [newEntry, ...entries]
    setEntries(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

    setName('')
    setMessage('')
    setIsSubmitting(false)

    toast.success('Deine Nachricht wurde ins Gästebuch eingetragen! 💙')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-champagne-light/20 to-white pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeInUp}>
            <SectionTitle
              title="Gästebuch"
              subtitle="Hinterlasst uns eine Nachricht, einen Wunsch oder eine Erinnerung – für immer in unserem Herzen."
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Form */}
            <motion.div variants={fadeInUp} className="lg:col-span-2">
              <Card padding="lg" className="sticky top-24">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-dark-blue rounded-xl flex items-center justify-center">
                    <MessageSquare size={18} className="text-white" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-dark-blue">
                    Eintrag hinterlassen
                  </h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <User size={14} className="inline mr-1" />
                      Dein Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Wie heißt du?"
                      maxLength={60}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <MessageSquare size={14} className="inline mr-1" />
                      Deine Nachricht *
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Schreib dem Brautpaar eine Nachricht, einen Wunsch oder eine nette Erinnerung..."
                      rows={5}
                      maxLength={500}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm resize-none"
                    />
                    <p className="text-xs text-gray-400 text-right mt-1">
                      {message.length}/500
                    </p>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Wird eingetragen...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Ins Gästebuch eintragen
                      </>
                    )}
                  </Button>
                </form>

                <p className="text-xs text-gray-400 text-center mt-4">
                  Dein Eintrag erscheint sofort im Gästebuch.
                </p>
              </Card>
            </motion.div>

            {/* Entries list */}
            <motion.div variants={fadeInUp} className="lg:col-span-3">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-serif text-xl font-semibold text-dark-blue flex items-center gap-2">
                  <Heart size={18} className="text-gold fill-gold" />
                  Nachrichten ({entries.length})
                </h3>
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {entries.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))}
                </AnimatePresence>

                {entries.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-base">Noch keine Einträge.</p>
                    <p className="text-sm mt-1">Sei der Erste und hinterlasse eine Nachricht!</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
