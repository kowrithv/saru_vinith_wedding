'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, PartyPopper, Users2, EyeOff, Check, User } from 'lucide-react'
import Button from '@/components/ui/Button'
import { couple, whoQuestions, whoGameOptions } from '@/lib/config'
import type { PublicWhoGameData } from '@/lib/who-game'

const STORAGE_KEY = 'who-game-votes-v1'
const NAME_STORAGE_KEY = 'who-game-voter-name'
const POLL_INTERVAL_MS = 4000

function loadLocalVotes(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalVote(questionId: string, option: string) {
  try {
    const votes = loadLocalVotes()
    votes[questionId] = option
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(votes))
  } catch {
    // localStorage kann in seltenen Fällen (z.B. privater Modus) fehlschlagen – dann bleibt der Klick trotzdem gültig
  }
}

function loadLocalName(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveLocalName(name: string) {
  try {
    window.localStorage.setItem(NAME_STORAGE_KEY, name)
  } catch {
    // s.o.
  }
}

function optionLabel(option: string): string {
  if (option === couple.bride) return couple.bride
  if (option === couple.groom) return couple.groom
  return option
}

export default function WhoKnowsUsGame() {
  const [gameData, setGameData] = useState<PublicWhoGameData | null>(null)
  const [myVotes, setMyVotes] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [voterName, setVoterName] = useState('')
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    setMyVotes(loadLocalVotes())
    setVoterName(loadLocalName())
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = () => {
      fetch('/api/who-votes', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: PublicWhoGameData | null) => {
          if (!cancelled && data) setGameData(data)
        })
        .catch(() => {})
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const currentQuestion = whoQuestions[currentIndex]
  const currentState = gameData?.questions[currentQuestion?.id ?? '']
  const myVote = myVotes[currentQuestion?.id ?? '']
  const hasVoted = Boolean(myVote)
  const isLastQuestion = currentIndex === whoQuestions.length - 1

  const totalVotes = currentState
    ? Object.values(currentState.tally).reduce((sum, n) => sum + n, 0)
    : 0

  const handleVote = async (option: string) => {
    if (hasVoted || !currentQuestion) return

    saveLocalVote(currentQuestion.id, option)
    setMyVotes((prev) => ({ ...prev, [currentQuestion.id]: option }))

    // Optimistisches Update, damit das Ergebnis sofort sichtbar ist
    setGameData((prev) => {
      if (!prev) return prev
      const state = prev.questions[currentQuestion.id]
      if (!state) return prev
      return {
        questions: {
          ...prev.questions,
          [currentQuestion.id]: {
            ...state,
            tally: { ...state.tally, [option]: (state.tally[option] ?? 0) + 1 },
          },
        },
      }
    })

    try {
      const response = await fetch('/api/who-votes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion.id, option, voterName }),
      })
      if (response.ok) {
        const data = (await response.json()) as PublicWhoGameData
        setGameData(data)
      }
    } catch {
      // Stimme bleibt lokal gespeichert, auch wenn der Server gerade nicht erreichbar ist
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      setFinished(true)
      return
    }
    setCurrentIndex((i) => i + 1)
  }

  const handleNameSubmit = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    saveLocalName(trimmed)
    setVoterName(trimmed)
  }

  if (!voterName) {
    return (
      <motion.div
        key="who-name-gate"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 text-center"
      >
        <div className="w-14 h-14 bg-champagne rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Users2 size={24} className="text-dark-blue" />
        </div>
        <h2 className="font-serif text-xl md:text-2xl font-semibold text-dark-blue mb-2">
          Wie heißt du?
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          So können wir bei der Feier zeigen, wer am besten getippt hat.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
          <div className="relative flex-1">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              placeholder="Dein Name"
              maxLength={60}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-dark-blue focus:ring-1 focus:ring-dark-blue outline-none transition-colors text-sm"
            />
          </div>
          <Button variant="primary" size="md" onClick={handleNameSubmit} disabled={!nameInput.trim()}>
            Los geht&apos;s
          </Button>
        </div>
      </motion.div>
    )
  }

  if (finished) {
    return (
      <motion.div
        key="who-finished"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring', damping: 20 }}
        className="text-center"
      >
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 15 }}
            className="w-20 h-20 bg-champagne rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <PartyPopper size={36} className="text-gold" />
          </motion.div>
          <h2 className="font-serif text-2xl font-semibold text-dark-blue mb-3">
            Danke fürs Mitraten! 🎉
          </h2>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-8">
            Eure Stimmen sind gezählt. Ob ihr richtig lagt, verraten wir gemeinsam bei der Feier –
            schaut später nochmal vorbei, dann sind vielleicht schon ein paar Antworten aufgelöst. 👀
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setCurrentIndex(0)
              setFinished(false)
            }}
          >
            Ergebnisse nochmal ansehen
          </Button>
        </div>
      </motion.div>
    )
  }

  if (!currentQuestion) return null

  return (
    <motion.div
      key={`who-question-${currentIndex}`}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
    >
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">
            Frage {currentIndex + 1} von {whoQuestions.length}
          </span>
          <span className="text-sm font-medium text-dark-blue flex items-center gap-1.5">
            <Users2 size={14} className="text-gold" />
            {totalVotes} Stimme{totalVotes === 1 ? '' : 'n'}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-dark-blue to-baby-blue rounded-full"
            initial={{ width: `${(currentIndex / whoQuestions.length) * 100}%` }}
            animate={{ width: `${((currentIndex + 1) / whoQuestions.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-dark-blue rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-semibold">{currentIndex + 1}</span>
          </div>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        <h2 className="font-serif text-xl md:text-2xl font-semibold text-dark-blue mb-6 leading-snug">
          {currentQuestion.question}
        </h2>

        {!hasVoted ? (
          /* Voting options */
          <div className="space-y-3 mb-2">
            {whoGameOptions.map((option) => (
              <motion.button
                key={option}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleVote(option)}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:border-dark-blue hover:bg-champagne/30 cursor-pointer transition-all duration-200"
              >
                <span className="text-sm md:text-base font-medium">{optionLabel(option)}</span>
              </motion.button>
            ))}
          </div>
        ) : (
          /* Live results */
          <div className="space-y-3 mb-2">
            {whoGameOptions.map((option) => {
              const votes = currentState?.tally[option] ?? 0
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
              const isMine = myVote === option
              const isRevealedCorrect = currentState?.revealed && currentState.correctAnswer === option

              return (
                <div
                  key={option}
                  className={`relative overflow-hidden rounded-xl border-2 p-4 transition-colors ${
                    isRevealedCorrect
                      ? 'border-green-400 bg-green-50'
                      : isMine
                      ? 'border-dark-blue bg-champagne/20'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`absolute inset-y-0 left-0 ${
                      isRevealedCorrect ? 'bg-green-100' : 'bg-champagne/40'
                    }`}
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <span className="text-sm md:text-base font-medium text-gray-800 flex items-center gap-2">
                      {optionLabel(option)}
                      {isMine && <span className="text-xs text-dark-blue/60">(deine Stimme)</span>}
                      {isRevealedCorrect && <Check size={16} className="text-green-600" />}
                    </span>
                    <span className="text-sm font-semibold text-dark-blue">{pct}%</span>
                  </div>
                </div>
              )
            })}

            {/* Reveal status */}
            <div className="pt-2">
              {currentState?.revealed ? (
                <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Check size={16} />
                  Aufgelöst: {currentState.correctAnswer ? optionLabel(currentState.correctAnswer) : '–'} liegt richtig!
                </p>
              ) : (
                <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
                  <EyeOff size={16} />
                  Wird bei der Feier live aufgelöst 👀
                </p>
              )}
            </div>
          </div>
        )}

        {/* Next button */}
        <AnimatePresence>
          {hasVoted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4"
            >
              <Button variant="primary" size="lg" className="w-full" onClick={handleNext}>
                {isLastQuestion ? (
                  <>
                    Fertig
                    <PartyPopper size={16} />
                  </>
                ) : (
                  <>
                    Nächste Frage
                    <ChevronRight size={16} />
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
