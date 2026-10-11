'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PartyPopper } from 'lucide-react'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'
import { getDeviceId } from '@/lib/device-id'
import { usePolling } from '@/lib/use-polling'
import { cn } from '@/lib/utils'

const VOTES_STORAGE_KEY = 'who-game-votes'

type TallyMap = Record<string, Record<string, number>>

function emptyTally(): TallyMap {
  return Object.fromEntries(
    whoQuestions.map((q) => [q.id, Object.fromEntries(whoGameOptions.map((o) => [o, 0]))])
  )
}

function loadLocalVotes(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(VOTES_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalVote(questionId: string, option: string) {
  try {
    const votes = loadLocalVotes()
    votes[questionId] = option
    window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes))
  } catch {
    // localStorage kann in seltenen Fällen fehlschlagen - die Stimme ist serverseitig trotzdem gezählt.
  }
}

export default function WhoKnowsUsGame() {
  const [tally, setTally] = useState<TallyMap>(emptyTally)
  const [myVotes, setMyVotes] = useState<Record<string, string>>(() =>
    typeof window === 'undefined' ? {} : loadLocalVotes()
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [finished, setFinished] = useState(false)

  usePolling(() => {
    fetch('/api/who-votes', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { questions: TallyMap } | null) => {
        if (data) setTally(data.questions)
      })
      .catch(() => {})
  })

  const currentQuestion = whoQuestions[currentIndex]
  const myVote = myVotes[currentQuestion?.id ?? '']
  const hasVoted = Boolean(myVote)
  const isLastQuestion = currentIndex === whoQuestions.length - 1
  const currentTally = tally[currentQuestion?.id ?? ''] ?? Object.fromEntries(whoGameOptions.map((o) => [o, 0]))
  const totalVotes = Object.values(currentTally).reduce((sum, n) => sum + n, 0)

  const handleVote = async (option: string) => {
    if (hasVoted || !currentQuestion) return

    try {
      const response = await fetch('/api/who-votes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion.id, voterId: getDeviceId(), option }),
      })
      if (!response.ok) return // Nicht bestätigt - nichts lokal vermerken, Gast kann es erneut versuchen.

      const data = (await response.json()) as { tally: Record<string, number> }
      saveLocalVote(currentQuestion.id, option)
      setMyVotes((prev) => ({ ...prev, [currentQuestion.id]: option }))
      setTally((prev) => ({ ...prev, [currentQuestion.id]: data.tally }))
    } catch {
      // Netzwerkfehler - nichts lokal vermerken, Gast kann es erneut versuchen.
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      setFinished(true)
      return
    }
    setCurrentIndex((i) => i + 1)
  }

  if (finished) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12"
      >
        <PartyPopper size={36} className="text-gold mx-auto mb-4" />
        <h3 className="font-serif text-xl font-semibold text-dark-blue mb-2">Danke fürs Mitmachen!</h3>
        <p className="text-gray-500 text-sm">
          Die Ergebnisse gibt es live bei der Feier zu sehen.
        </p>
      </motion.div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8"
      >
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Frage {currentIndex + 1} von {whoQuestions.length}
        </p>
        <h3 className="font-serif text-lg md:text-xl font-semibold text-dark-blue mb-6">
          {currentQuestion.question}
        </h3>

        {!hasVoted ? (
          <div className="flex flex-col gap-3">
            {whoGameOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleVote(option)}
                className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-dark-blue hover:bg-champagne/30 transition-colors text-left"
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {whoGameOptions.map((option) => {
              const count = currentTally[option] ?? 0
              const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
              return (
                <div key={option}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span
                      className={cn(
                        'font-medium',
                        option === myVote ? 'text-dark-blue' : 'text-gray-600'
                      )}
                    >
                      {option}
                      {option === myVote && ' (deine Stimme)'}
                    </span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleNext}
          className="mt-6 w-full px-5 py-3 rounded-xl bg-dark-blue text-white text-sm font-medium hover:bg-dark-blue-light transition-colors"
        >
          {isLastQuestion ? 'Fertig' : 'Weiter'}
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
