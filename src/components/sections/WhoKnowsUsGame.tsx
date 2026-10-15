'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { whoQuestions, whoGameOptions } from '@/lib/who-game-content'
import { getDeviceId } from '@/lib/device-id'
import { usePolling } from '@/lib/use-polling'
import Lotus from '@/components/ui/Lotus'
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

// Jede Antwort bekommt ihre Farbe: Saruga in Bordeaux, Vinith in Dunkelblau,
// "Beide" in Gold. Die Marke ist rein dekorativ (der Name steht daneben).
function OptionBadge({ option }: { option: string }) {
  if (option === 'Saruga' || option === 'Vinith') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold text-white',
          option === 'Saruga' ? 'bg-bordeaux' : 'bg-dark-blue'
        )}
      >
        {option.charAt(0)}
      </span>
    )
  }
  return (
    <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-champagne">
      <Lotus size={18} className="text-gold-dark" />
    </span>
  )
}

function barColor(option: string): string {
  if (option === 'Saruga') return 'bg-bordeaux'
  if (option === 'Vinith') return 'bg-dark-blue'
  return 'bg-gold'
}

export default function WhoKnowsUsGame() {
  const [tally, setTally] = useState<TallyMap>(emptyTally)
  const [myVotes, setMyVotes] = useState<Record<string, string>>(() =>
    typeof window === 'undefined' ? {} : loadLocalVotes()
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

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
    setVoteError(null)

    try {
      const response = await fetch('/api/who-votes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion.id, voterId: getDeviceId(), option }),
      })
      if (!response.ok) {
        // Nicht bestätigt - nichts lokal vermerken, Gast kann es erneut versuchen.
        const data = await response.json().catch(() => null)
        setVoteError(data?.error ?? 'Abstimmen fehlgeschlagen. Bitte versuch es erneut.')
        return
      }

      const data = (await response.json()) as { tally: Record<string, number> }
      saveLocalVote(currentQuestion.id, option)
      setMyVotes((prev) => ({ ...prev, [currentQuestion.id]: option }))
      setTally((prev) => ({ ...prev, [currentQuestion.id]: data.tally }))
    } catch {
      // Netzwerkfehler - nichts lokal vermerken, Gast kann es erneut versuchen.
      setVoteError('Abstimmen fehlgeschlagen. Bitte versuch es erneut.')
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
        className="card-ornate text-center rounded-3xl p-8 md:p-12"
      >
        <Lotus size={44} className="text-gold mx-auto mb-4" />
        <h3 className="font-display text-3xl font-semibold text-dark-blue mb-2">Danke fürs Mitmachen!</h3>
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
        className="card-ornate rounded-3xl p-6 md:p-8"
      >
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 text-center">
          Frage {currentIndex + 1} von {whoQuestions.length}
        </p>
        <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight text-dark-blue mb-6 text-center">
          {currentQuestion.question}
        </h3>

        {!hasVoted ? (
          <div className="flex flex-col gap-3">
            {whoGameOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleVote(option)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-[1.5px] border-champagne-dark bg-white text-sm font-medium text-gray-700 hover:border-dark-blue hover:bg-champagne/30 transition-colors text-left"
              >
                <OptionBadge option={option} />
                <span>{option}</span>
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
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', barColor(option))}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {voteError && (
          <p className="text-sm text-red-600 mt-4" role="alert">
            {voteError}
          </p>
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
